import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import contract from "./contract.json" with { type: "json" };
import {
  ACK_CANCEL_SQL,
  CANCEL_QUEUED_SQL,
  CANCEL_RUNNING_SQL,
  CLAIM_BY_ID_SQL,
  COMPLETE_SQL,
  FAIL_SQL,
  GPU_ONE_RUNNING_SQL,
  HEARTBEAT_SQL,
  LIMITS,
  MODULE_TIMEOUT_SEC,
  REQUEST_CANCEL_SQL,
  SQLITE_PRAGMAS,
  SWEEP_SQLS,
  SWEEP_STALE_SQL,
  SWEEP_TIMEOUT_SQL,
  claimPickSql,
  deadlineAtIso,
  defaultTimeout,
  leaseUntilIso,
  utcIso,
  type Module,
} from "./job.js";

const here = dirname(fileURLToPath(import.meta.url));

/** The DDL comes straight from docs/plan/03 so the doc and the tested SQL cannot drift apart. */
function docDdl(): string {
  const md = readFileSync(join(here, "../../docs/plan/03-contratos-datos-variables.md"), "utf8");
  const m = md.match(/```sql\r?\n([\s\S]*?)```/);
  if (!m) throw new Error("no ```sql block in docs/plan/03");
  return m[1];
}

const T0 = Date.parse("2026-09-18T00:00:00.000Z");
type Row = Record<string, unknown>;

function openDb(path = ":memory:"): DatabaseSync {
  const db = new DatabaseSync(path);
  for (const p of SQLITE_PRAGMAS) db.exec(p);
  db.exec(docDdl());
  db.prepare(
    "INSERT INTO projects (id, title, channel, created_at, updated_at) VALUES ('p1','t','c',?,?)",
  ).run(utcIso(T0), utcIso(T0));
  return db;
}

let seq = 0;
function insertJob(db: DatabaseSync, id: string, module: Module, status = "queued", cancel = 0) {
  db.prepare(
    `INSERT INTO jobs (id, project_id, module, status, timeout_sec, idempotency_key, created_by,
                       input_hash, input_json, created_at, updated_at, cancel_requested)
     VALUES (?, 'p1', ?, ?, ?, ?, 'api', 'h', '{}', ?, ?, ?)`,
  ).run(id, module, status, defaultTimeout(module), `k-${id}`, utcIso(T0 + seq++), utcIso(T0), cancel);
}

function claimParams(id: string, owner: string, nowMs = T0, timeoutSec = 120) {
  return {
    id,
    owner,
    now: utcIso(nowMs),
    lease_until: leaseUntilIso(nowMs),
    deadline_at: deadlineAtIso(nowMs, timeoutSec),
  };
}

const claim = (db: DatabaseSync, id: string, owner: string, nowMs = T0, timeoutSec = 120) =>
  db.prepare(CLAIM_BY_ID_SQL).get(claimParams(id, owner, nowMs, timeoutSec)) as Row | undefined;

const state = (db: DatabaseSync, id: string) =>
  db.prepare("SELECT status, error_code, claimed_by FROM jobs WHERE id = ?").get(id) as Row;

const doneParams = (id: string, owner: string, nowMs = T0) => ({
  id,
  owner,
  now: utcIso(nowMs),
  output_json: '{"files":[],"meta":{}}',
  bytes_out: 10,
  cost_usd: null,
  tokens_in: null,
  tokens_out: null,
  gpu_sec: null,
  stock_calls: null,
});

describe("constants", () => {
  it("freezes v1 budgets", () => {
    expect(MODULE_TIMEOUT_SEC.tts).toBe(120);
    expect(MODULE_TIMEOUT_SEC.assemble).toBe(600);
    expect(MODULE_TIMEOUT_SEC.script).toBe(180);
    expect(MODULE_TIMEOUT_SEC.thumb).toBe(60);
    expect(defaultTimeout("tts")).toBe(120);
  });
  it("keeps lease short and independent of timeout", () => {
    expect(LIMITS.LEASE_MS).toBe(30_000);
    expect(LIMITS.HEARTBEAT_MS).toBe(10_000);
    expect(LIMITS.SWEEP_MS).toBe(12_000);
    expect(Date.parse(leaseUntilIso(T0)) - T0).toBe(LIMITS.LEASE_MS);
    expect(Date.parse(deadlineAtIso(T0, 120)) - T0).toBe(120_000);
  });
  it("E1-L1 product numbers live here", () => {
    expect(LIMITS.IMPRESSION_FLOOR).toBe(1000);
    expect(LIMITS.SCRIPT_MAX_TOKENS).toBe(4096);
    expect(LIMITS.SEO_CTR_GAP).toBe(0.02);
  });
  it("busy_timeout is the FIRST pragma and comes from LIMITS (no second copy of the number)", () => {
    expect(SQLITE_PRAGMAS[0]).toBe(`PRAGMA busy_timeout = ${LIMITS.SQLITE_BUSY_TIMEOUT_MS}`);
    expect(SQLITE_PRAGMAS).toContain("PRAGMA journal_mode = WAL");
  });
  it("contract.json exposes every statement", () => {
    for (const k of [
      "claimById", "claimPickTemplate", "heartbeat", "complete", "fail",
      "cancelRunning", "cancelQueued", "requestCancel", "ackCancel",
      "addBytes", "reconcileBytes", "sweepStale", "sweepTimeout", "sweepAll", "oneGpuRunning",
    ]) {
      expect(contract.sql).toHaveProperty(k);
    }
    expect(contract.sql.claimById).toBe(CLAIM_BY_ID_SQL);
    expect(contract.limits.LEASE_MS).toBe(LIMITS.LEASE_MS);
    expect(contract.limits.IMPRESSION_FLOOR).toBe(LIMITS.IMPRESSION_FLOOR);
  });
  it("E1-Q1 SQL uses named params shared by TS and Python", () => {
    expect(HEARTBEAT_SQL).toContain(":now");
    expect(contract.sql.heartbeat).toContain(":now");
    expect(COMPLETE_SQL).toContain("RETURNING");
    expect(contract.sql.complete).toContain("RETURNING");
  });
  it("claimPickSql rejects unknown or empty module lists", () => {
    expect(() => claimPickSql([])).toThrow();
    expect(() => claimPickSql(["x'; DROP TABLE jobs;--" as Module])).toThrow();
  });
});

describe("claim (single connection)", () => {
  it("wins once; the second claim of the same id gets no row", () => {
    const db = openDb();
    insertJob(db, "j1", "tts");
    expect(claim(db, "j1", "cpu-a")?.claimed_by).toBe("cpu-a");
    expect(claim(db, "j1", "cpu-b")).toBeUndefined();
  });

  it("does not claim a job whose cancel was requested", () => {
    const db = openDb();
    insertJob(db, "j1", "tts", "queued", 1);
    expect(claim(db, "j1", "cpu-a")).toBeUndefined();
    expect(db.prepare(claimPickSql(["tts"])).get()).toBeUndefined();
  });

  it("claimPick returns CPU-first then oldest, for the requested modules only", () => {
    const db = openDb();
    insertJob(db, "a", "assemble");
    insertJob(db, "b", "tts");
    insertJob(db, "c", "tts");
    expect((db.prepare(claimPickSql(["tts"])).get() as Row).id).toBe("b");
    // script/tts/captions/assemble: tts outranks assemble even if assemble is older
    expect((db.prepare(claimPickSql(["tts", "assemble"])).get() as Row).id).toBe("b");
    expect((db.prepare(claimPickSql(["assemble"])).get() as Row).id).toBe("a");
  });

  it("GPU: a second GPU claim returns no row (does not throw); CPU is unaffected", () => {
    const db = openDb();
    insertJob(db, "g1", "image");
    insertJob(db, "g2", "video");
    insertJob(db, "c1", "tts");
    expect(claim(db, "g1", "gpu")).toBeDefined();
    expect(() => claim(db, "g2", "gpu")).not.toThrow();
    expect(claim(db, "g2", "gpu")).toBeUndefined();
    expect(claim(db, "c1", "cpu")).toBeDefined();
    expect(db.prepare(COMPLETE_SQL).get(doneParams("g1", "gpu"))).toBeDefined();
    expect(claim(db, "g2", "gpu")).toBeDefined();
  });

  it("GPU: the unique index is a real backstop for writes that bypass the claim", () => {
    const db = openDb();
    insertJob(db, "g1", "image", "running");
    insertJob(db, "g2", "image");
    expect(() => db.prepare("UPDATE jobs SET status = 'running' WHERE id = 'g2'").run()).toThrow(/UNIQUE/);
  });

  it("GPU_ONE_RUNNING_SQL creates a working index on its own", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE TABLE jobs (id TEXT PRIMARY KEY, module TEXT, status TEXT)");
    db.exec(GPU_ONE_RUNNING_SQL);
    db.prepare("INSERT INTO jobs VALUES ('a','image','running')").run();
    db.prepare("INSERT INTO jobs VALUES ('c','tts','running')").run();
    db.prepare("INSERT INTO jobs VALUES ('d','tts','running')").run();
    expect(() => db.prepare("INSERT INTO jobs VALUES ('b','video','running')").run()).toThrow(/UNIQUE/);
  });
});

describe("heartbeat", () => {
  it("renews the lease and reports cancel_requested", () => {
    const db = openDb();
    insertJob(db, "j1", "tts");
    claim(db, "j1", "cpu-a");
    const hb = { id: "j1", owner: "cpu-a", now: utcIso(T0 + 10_000), lease_until: leaseUntilIso(T0 + 10_000) };
    expect((db.prepare(HEARTBEAT_SQL).get(hb) as Row).cancel_requested).toBe(0);
    db.prepare(REQUEST_CANCEL_SQL).get({ id: "j1", now: utcIso(T0) });
    expect((db.prepare(HEARTBEAT_SQL).get(hb) as Row).cancel_requested).toBe(1);
  });

  it("returns no row for a foreign owner or after the job was swept (lease lost)", () => {
    const db = openDb();
    insertJob(db, "j1", "tts");
    claim(db, "j1", "cpu-a");
    const late = T0 + 60_000;
    const hb = (owner: string) =>
      db.prepare(HEARTBEAT_SQL).get({ id: "j1", owner, now: utcIso(late), lease_until: leaseUntilIso(late) });
    expect(hb("cpu-b")).toBeUndefined();
    db.prepare(SWEEP_STALE_SQL).run({ now: utcIso(late) });
    expect(hb("cpu-a")).toBeUndefined();
  });
});

describe("sweepers", () => {
  const LATE = utcIso(T0 + 5 * 60_000);

  function expiredBoth(db: DatabaseSync, id: string) {
    insertJob(db, id, "tts", "running");
    db.prepare("UPDATE jobs SET claimed_by='w', lease_until=?, deadline_at=? WHERE id=?")
      .run(utcIso(T0 + 10_000), utcIso(T0 + 20_000), id);
  }

  it("lease expired AND deadline expired is `timeout` in either sweep order", () => {
    for (const order of [
      [SWEEP_STALE_SQL, SWEEP_TIMEOUT_SQL],
      [SWEEP_TIMEOUT_SQL, SWEEP_STALE_SQL],
    ]) {
      const db = openDb();
      expiredBoth(db, "j1");
      for (const sql of order) db.prepare(sql).run({ now: LATE });
      expect(state(db, "j1").error_code).toBe("timeout");
    }
  });

  it("lease expired with deadline still in the future is `stale`", () => {
    const db = openDb();
    insertJob(db, "j1", "tts", "running");
    db.prepare("UPDATE jobs SET lease_until=?, deadline_at=? WHERE id='j1'")
      .run(utcIso(T0 + 10_000), utcIso(T0 + 10 * 60_000));
    db.prepare(SWEEP_TIMEOUT_SQL).run({ now: LATE });
    db.prepare(SWEEP_STALE_SQL).run({ now: LATE });
    expect(state(db, "j1").error_code).toBe("stale");
  });

  it("fresh lease + expired deadline is `timeout` (a heartbeating worker still times out)", () => {
    const db = openDb();
    insertJob(db, "j1", "tts", "running");
    db.prepare("UPDATE jobs SET lease_until=?, deadline_at=? WHERE id='j1'")
      .run(utcIso(T0 + 10 * 60_000), utcIso(T0 + 20_000));
    db.prepare(SWEEP_STALE_SQL).run({ now: LATE });
    db.prepare(SWEEP_TIMEOUT_SQL).run({ now: LATE });
    expect(state(db, "j1").error_code).toBe("timeout");
  });

  it("a running row with NULL lease/deadline is swept as stale, never left running", () => {
    const db = openDb();
    insertJob(db, "j1", "tts", "running");
    db.prepare(SWEEP_TIMEOUT_SQL).run({ now: LATE });
    db.prepare(SWEEP_STALE_SQL).run({ now: LATE });
    expect(state(db, "j1")).toMatchObject({ status: "error", error_code: "stale" });
  });

  it("SWEEP_SQLS together leave no expired running job behind", () => {
    const db = openDb();
    insertJob(db, "dead", "tts");
    insertJob(db, "slow", "tts");
    claim(db, "dead", "w");
    claim(db, "slow", "w");
    db.prepare("UPDATE jobs SET lease_until = ? WHERE id = 'slow'").run(utcIso(T0 + 10 * 60_000));
    for (const sql of SWEEP_SQLS) db.prepare(sql).run({ now: LATE });
    expect(state(db, "dead").error_code).toBe("timeout");
    expect(state(db, "slow").error_code).toBe("timeout");
    expect(db.prepare("SELECT count(*) AS n FROM jobs WHERE status='running'").get()).toMatchObject({ n: 0 });
  });

  it("leaves healthy and queued jobs alone", () => {
    const db = openDb();
    insertJob(db, "ok", "tts");
    insertJob(db, "q", "tts");
    claim(db, "ok", "w", T0 + 4.9 * 60_000);
    db.prepare(SWEEP_STALE_SQL).run({ now: LATE });
    db.prepare(SWEEP_TIMEOUT_SQL).run({ now: LATE });
    expect(state(db, "ok").status).toBe("running");
    expect(state(db, "q").status).toBe("queued");
  });
});

describe("guarded terminal transitions", () => {
  it("a worker that lost its lease cannot overwrite the sweeper's verdict", () => {
    const db = openDb();
    insertJob(db, "j1", "tts");
    claim(db, "j1", "cpu-a");
    for (const sql of SWEEP_SQLS) db.prepare(sql).run({ now: utcIso(T0 + 5 * 60_000) });
    expect(state(db, "j1").status).toBe("error");
    expect(db.prepare(COMPLETE_SQL).get(doneParams("j1", "cpu-a"))).toBeUndefined();
    expect(db.prepare(FAIL_SQL).get({ id: "j1", owner: "cpu-a", now: utcIso(T0), error_code: "io", error: "x" })).toBeUndefined();
    expect(state(db, "j1")).toMatchObject({ status: "error", error_code: "timeout" });
  });

  it("only the owner can complete; completion clears stale error fields", () => {
    const db = openDb();
    insertJob(db, "j1", "tts");
    claim(db, "j1", "cpu-a");
    expect(db.prepare(COMPLETE_SQL).get(doneParams("j1", "cpu-b"))).toBeUndefined();
    expect(db.prepare(COMPLETE_SQL).get(doneParams("j1", "cpu-a"))).toBeDefined();
    const r = db.prepare("SELECT status, progress, bytes_out, error, error_code, claimed_by FROM jobs WHERE id='j1'").get() as Row;
    expect(r).toMatchObject({ status: "done", progress: 1, bytes_out: 10, error: null, error_code: null, claimed_by: null });
  });

  it("fail records a machine code and a human message", () => {
    const db = openDb();
    insertJob(db, "j1", "tts");
    claim(db, "j1", "cpu-a");
    db.prepare(FAIL_SQL).get({ id: "j1", owner: "cpu-a", now: utcIso(T0), error_code: "io", error: "disk full" });
    expect(state(db, "j1")).toMatchObject({ status: "error", error_code: "io", claimed_by: null });
  });

  it("cancel: queued cancels directly; running goes through flag + worker ack", () => {
    const db = openDb();
    insertJob(db, "q", "tts");
    insertJob(db, "r", "tts");
    claim(db, "r", "cpu-a");
    const p = (id: string) => ({ id, now: utcIso(T0) });
    expect(db.prepare(CANCEL_QUEUED_SQL).get(p("q"))).toBeDefined();
    expect(db.prepare(CANCEL_QUEUED_SQL).get(p("r"))).toBeUndefined();
    expect(db.prepare(REQUEST_CANCEL_SQL).get(p("q"))).toBeUndefined();
    expect(db.prepare(REQUEST_CANCEL_SQL).get(p("r"))).toBeDefined();
    expect(db.prepare(ACK_CANCEL_SQL).get({ ...p("r"), owner: "cpu-b" })).toBeUndefined();
    expect(db.prepare(ACK_CANCEL_SQL).get({ ...p("r"), owner: "cpu-a" })).toBeDefined();
    expect(state(db, "r")).toMatchObject({ status: "canceled", error_code: "canceled" });
    expect(state(db, "q").status).toBe("canceled");
  });

  it("ack without a cancel request changes nothing", () => {
    const db = openDb();
    insertJob(db, "r", "tts");
    claim(db, "r", "cpu-a");
    expect(db.prepare(ACK_CANCEL_SQL).get({ id: "r", now: utcIso(T0), owner: "cpu-a" })).toBeUndefined();
  });

  it("CANCEL_RUNNING_SQL is owner-guarded", () => {
    const db = openDb();
    insertJob(db, "r", "tts");
    claim(db, "r", "cpu-a");
    const p = { id: "r", now: utcIso(T0), owner: "cpu-b" };
    expect(db.prepare(CANCEL_RUNNING_SQL).get(p)).toBeUndefined();
    expect(db.prepare(CANCEL_RUNNING_SQL).get({ ...p, owner: "cpu-a" })).toBeDefined();
    expect(state(db, "r")).toMatchObject({ status: "canceled", error_code: "canceled", claimed_by: null });
  });
});

type WorkerResult = { worker: string; claimed: string[]; errors: string[] };

function runWorkers(dbPath: string, mode: "race" | "drain", n: number, modules: Module[], jobId = ""): Promise<WorkerResult[]> {
  const startAt = Date.now() + 2000;
  const script = join(here, "test-support/claim-worker.ts");
  return Promise.all(
    Array.from({ length: n }, (_, i) =>
      new Promise<WorkerResult>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ["--disable-warning=ExperimentalWarning", "--import", "tsx", script,
           dbPath, mode, `w${i}`, String(startAt), modules.join(","), jobId],
          { cwd: here },
        );
        let out = "";
        let err = "";
        child.stdout.on("data", (d) => (out += d));
        child.stderr.on("data", (d) => (err += d));
        child.on("close", (code) => {
          if (code !== 0) return reject(new Error(`worker w${i} exited ${code}: ${err}`));
          resolve(JSON.parse(out.trim().split("\n").pop() as string));
        });
      }),
    ),
  );
}

describe("claim (real multi-process concurrency)", () => {
  const freshFile = () => join(mkdtempSync(join(tmpdir(), "faceless-claim-")), "t.sqlite");

  it("8 processes race for one queued job: exactly one winner, no errors", async () => {
    const path = freshFile();
    const db = openDb(path);
    insertJob(db, "j1", "tts");
    db.close();
    const res = await runWorkers(path, "race", 8, ["tts"], "j1");
    expect(res.flatMap((r) => r.errors)).toEqual([]);
    expect(res.flatMap((r) => r.claimed)).toEqual(["j1"]);
  }, 30_000);

  it("4 processes drain 40 jobs: every job claimed exactly once", async () => {
    const path = freshFile();
    const db = openDb(path);
    const ids = Array.from({ length: 40 }, (_, i) => `t${String(i).padStart(2, "0")}`);
    for (const id of ids) insertJob(db, id, "tts");
    db.close();
    const res = await runWorkers(path, "drain", 4, ["tts"]);
    expect(res.flatMap((r) => r.errors)).toEqual([]);
    const all = res.flatMap((r) => r.claimed);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual(ids);
  }, 30_000);

  it("3 processes contend for 6 GPU jobs: exactly one runs, nobody throws", async () => {
    const path = freshFile();
    const db = openDb(path);
    for (let i = 0; i < 6; i++) insertJob(db, `g${i}`, i % 2 ? "video" : "image");
    db.close();
    const res = await runWorkers(path, "drain", 3, ["image", "video"]);
    expect(res.flatMap((r) => r.errors)).toEqual([]);
    expect(res.flatMap((r) => r.claimed)).toHaveLength(1);
    const check = new DatabaseSync(path);
    expect((check.prepare("SELECT count(*) AS n FROM jobs WHERE status='running'").get() as Row).n).toBe(1);
    check.close();
  }, 30_000);
});

function pythonBin(): string | undefined {
  for (const cmd of ["python3", "python"]) {
    const r = spawnSync(cmd, ["--version"], { encoding: "utf8" });
    if (r.status === 0 && /Python 3/i.test(`${r.stdout}${r.stderr}`)) return cmd;
  }
  return undefined;
}

const py = pythonBin();

describe("Python sqlite3 runs the same contract", () => {
  it.skipIf(!py)("claim -> heartbeat -> complete with named params", () => {
    const path = join(mkdtempSync(join(tmpdir(), "faceless-py-")), "t.sqlite");
    const db = openDb(path);
    insertJob(db, "j1", "tts");
    db.close();
    const script = `
import json, sqlite3, sys
p = json.load(sys.stdin)
conn = sqlite3.connect(p["db"], isolation_level=None, timeout=5)
out = {"sqlite": sqlite3.sqlite_version_info}
if sqlite3.sqlite_version_info < (3, 35):
    print(json.dumps(out)); sys.exit(0)
out["claim"] = len(conn.execute(p["claim"], p["claimParams"]).fetchall())
out["claim_again"] = len(conn.execute(p["claim"], p["claimParams"]).fetchall())
out["hb"] = conn.execute(p["hb"], p["hbParams"]).fetchall()
out["done"] = len(conn.execute(p["done"], p["doneParams"]).fetchall())
print(json.dumps(out))
`;
    const payload = {
      db: path,
      claim: CLAIM_BY_ID_SQL,
      claimParams: claimParams("j1", "py-a"),
      hb: HEARTBEAT_SQL,
      hbParams: { id: "j1", owner: "py-a", now: utcIso(T0), lease_until: leaseUntilIso(T0) },
      done: COMPLETE_SQL,
      doneParams: doneParams("j1", "py-a"),
    };
    const r = spawnSync(py as string, ["-c", script], { input: JSON.stringify(payload), encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
    const out = JSON.parse(r.stdout);
    if (!("claim" in out)) return;
    expect(out).toMatchObject({ claim: 1, claim_again: 0, hb: [[0]], done: 1 });
  }, 30_000);
});
