# Project review — suite faceless

Axes: performance / stability / quality
Stack specified: TypeScript (Vite + React + Hono), Python 3.11 workers, ComfyUI, Piper, ffmpeg, SQLite; cloud adapters in B/C
Configs honored: none on disk (Compose only as a sketch in `02` §15)
Files sampled: 3 markdown specs (~66 KB). Inventory hits: 0 (no source).
Findings: 0 critical / 4 high / 6 medium / 3 low / 2 note
Date: 18 September 2026

These are a product map, a stack design, and three architecture options — not a repo. The design is already production-shaped on **boundaries**. The highest-leverage gap is that failure, timeout, and disk/GPU bounds are not part of the Job contract.

## Scores

- Performance — 3/5 — GPU serialization and short clips are right; job, disk, and poll paths have no caps.
- Stability — 2/5 — File lock is correct; I/O paths lack timeout, idempotency, and a crash story.
- Quality — 4/5 — Module boundaries are strong. Three docs still disagree on who orchestrates.

## Summary

- Job is missing `timeoutSec`, `idempotencyKey`, `engine`, `bytesOut`, and `canceled`. See `packages/schema/job.ts`.
- GPU / Comfy / ffmpeg / GSC / YouTube DOM are unbounded I/O in the spec.
- SQLite-as-queue is unsafe the moment two workers exist (proposal C).
- Build order is correct: do not start with Wan.
- A vs B vs C is a real fork. Do not ship a bit of all three without `engine-policy`.

## Findings

### Stability

**[high] no I/O timeout** — 02 §4.2, §7.2, §10
Fix: timeoutSec per module (image 180, video 900, tts 120, whisper 300).

**[high] SQLite queue race** — 02 §1.2, §2.1
Fix: claim with UPDATE ... WHERE status='queued' and rowcount == 1. Heartbeat updatedAt.

**[high] jobs are not idempotent** — 02 §1.4
Fix: idempotencyKey on create.

**[medium] split brain process vs SQLite** — 02 §10
Fix: fsync + atomic rename, then COMMIT done. Reconcile running on boot.

**[medium] extractor ratio without subscribers** — 01 §1
Fix: ratio is null unless subscribers is measured.

### Performance

**[high] unbounded /outputs and queue** — 02 §1.6; 03 C
Fix: maxQueuedGpu = 3, maxProjectBytes 20 GB, refuse n > 4.

**[medium] poll loop as progress bus** — 02 §2.1
Fix: poll for v1; later SSE.

**[medium] giant ffmpeg filtergraph** — 02 §9.2
Fix: segment 15-30 s, concat demuxer.

**[low] stock search uncached** — 02 §6
Fix: cache source+q+orient 24 h.

### Quality

**[medium] three orchestrators** — 01 vs 02 vs 03
Fix: A to first MP4; freeze schema before UI.

**[medium] no contract tests** — 02 §11
Fix: one contract test per module.

**[low] 21-day SEO clock** — 01 §2
Fix: impression floor; do not delete while rising.

**[low] fuzzy assembler done** — 01 §8
Fix: spec-JSON to ffmpeg only. export/master_16x9.mp4 is done.

**[note] Build order in 01 §12 is correct.**
**[note] Stock license path should not fork across A/B/C.**

## Fix order

1. Extend Job — S
2. Claim-row queue + GPU lock + boot reconcile — S
3. Disk/queue caps — S
4. ratio = null without subscribers — S
5. Segmented ffmpeg — M
6. Contract tests — M
7. Choose A or C-mode-cloud — S to decide
