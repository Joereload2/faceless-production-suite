# Contratos, datos y variables

Fuente de tipos y numeros: `packages/schema/job.ts`.
Si este doc y el archivo discrepan, se corrige el doc en el mismo PR que el archivo.

## Arbol de datos en disco

```
data/
  studio.sqlite
  studio.sqlite-journal
  cache/stock/<sha>/
  projects/<projectId>/
    project.json          # snapshot liviano, no fuente de verdad
    tts/<jobId>/voice.wav
    stock/<jobId>/
    image/<jobId>/
    video/<jobId>/
    captions/<jobId>/captions.srt
    assemble/<jobId>/seg-000.mp4
    export/master_16x9.mp4
    export/thumb.svg
    export/thumb.png
    export/youtube-card.json
    attribution.json      # acumulado del proyecto
```

Todo bajo `data/` esta en `.gitignore`. Fixtures de test viven en `packages/*/fixtures/` o `workers/*/fixtures/` y pesan poco.

## Tablas SQLite

```sql
CREATE TABLE projects (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  channel       TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  bytes_used    INTEGER NOT NULL DEFAULT 0,
  approved_script_job_id TEXT,
  approved_script_hash   TEXT,
  approved_script_at     TEXT,
  approved_master_job_id TEXT,
  approved_master_hash   TEXT,
  approved_master_at     TEXT,
  approved_thumb_job_id  TEXT,
  approved_thumb_hash    TEXT,
  approved_thumb_at      TEXT,
  originality_checklist_json TEXT,
  publish_checklist_json TEXT
);

CREATE TABLE jobs (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id),
  module           TEXT NOT NULL,
  engine           TEXT NOT NULL DEFAULT 'local',
  status           TEXT NOT NULL,
  progress         REAL NOT NULL DEFAULT 0,
  timeout_sec      INTEGER NOT NULL,
  idempotency_key  TEXT NOT NULL,
  created_by       TEXT NOT NULL,
  claimed_by       TEXT,
  input_hash       TEXT NOT NULL,
  cancel_requested INTEGER NOT NULL DEFAULT 0,
  input_json       TEXT NOT NULL,
  output_json      TEXT,
  error            TEXT,
  error_code       TEXT,
  bytes_out        INTEGER,
  cost_usd         REAL,
  tokens_in        INTEGER,
  tokens_out       INTEGER,
  gpu_sec          REAL,
  stock_calls      INTEGER,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  lease_until      TEXT,
  deadline_at      TEXT
);

CREATE UNIQUE INDEX jobs_idempotency ON jobs(project_id, idempotency_key);
CREATE INDEX jobs_status ON jobs(status, updated_at);
CREATE UNIQUE INDEX one_gpu_running
  ON jobs(status)
  WHERE status = 'running' AND module IN ('image', 'video');
```

Mapeo TS ↔ SQL: camelCase en TypeScript, snake_case en SQL. Drizzle es el unico lugar que traduce. Nadie escribe `updatedAt` en SQL crudo salvo las constantes de `packages/schema`.

## Job (campos)

Ver interfaz `Job` en `packages/schema/job.ts`.

Reglas:

- `id` = ulid.
- `idempotencyKey` = string no vacio. Lo genera la UI o el caller. El server no lo reescribe.
- `created_by` = quien creo el job (`api` | `extension` | hostname).
- `claimed_by` = worker que tiene el lease.
- `lease_until` = corto (~30 s), lo renueva el heartbeat. No es el timeout del modulo.
- `deadline_at` = `now + timeout_sec` al claim; **no** se renueva.
- `cancel_requested` = flag cooperativo.
- `input_hash` = SHA-256 del JSON canonico del input.
- `engine` = `local` en v1. `cloud` rechazado si `CLOUD_JOBS` != `1`.
- `progress` = 0..1.
- `input` se valida con Zod **por modulo** antes de persistir.
- `error` es mensaje seguro para humanos. `errorCode` es maquina: `timeout` | `stale` | `budget` | `validation` | `io` | `config` | `canceled` | `internal` | `idempotency_conflict` | `unauthorized`.
- Aprobaciones ligadas a artefacto (`approved_*_job_id` + hash + at), no booleanos. Nuevo `assemble` (insert, no replay) anula master.
- Auth SPA: cookie HttpOnly `studio_token` (HMAC). Bearer solo curl.
- FIFO: `claimPickSql(modules)` + `CLAIM_BY_ID_SQL` dentro de `BEGIN IMMEDIATE`.
- Modulos `script` y `thumb` en Zod `ModuleInput`.
- SQL de cola: parametros con nombre (`:owner`, `:now`, ...) para que TS y Python bindeen igual.

## Modulos

| module | Quien lo corre | Input minimo | Output esperado |
|---|---|---|---|
| `tts` | worker-cpu | `{ text, voice? }` | `voice.wav` |
| `stock` | worker-cpu o api | `{ query, orientation, count }` | archivos + attribution |
| `image` | worker-gpu | `{ prompt, variants 1..4, preset: image-v1 }` | png |
| `video` | worker-gpu | `{ prompt, seconds, preset: video-v1 }` | mp4 corto |
| `captions` | worker-cpu | `{ audioJobId }` | `captions.srt` |
| `assemble` | worker-cpu | `{ spec: AssembleSpec }` con `fileName`, `timelineStartSec`/`timelineEndSec`; audio mezclado una vez al final | `export/master_16x9.mp4` |
| `seo` | worker-cpu / cron | `{ siteUrl, days }` | tabla huecos en output.meta |
| `script` | worker-cpu | `{ brief, language, targetDurationSec }` | `script/<jobId>/script.json` + `script/<jobId>/shotlist.json` (puerta 1 hashea bytes de `script.json`) |
| `thumb` | worker-cpu | `{ masterJobId, title, overlayText, description, tags }` | `export/thumb.png` + ficha YT |

Modulos extra v1 (tras el analisis 18-sep): `script` (guion + shot list, puerta 1), `thumb` (empaque, puerta 2). Outliers y publish siguen fuera del Job (tablas / flujo humano).

## SQL de claim, heartbeat y sweeper

Fuente: `packages/schema/job.ts`, exportado a `contract.json` (`version: 2`). Todo el SQL usa **parametros con nombre** (`:owner`, `:now`, ...) para que TS y Python bindeen igual. Requiere SQLite >= 3.35 (`RETURNING`).

- **Elegir candidato**: `claimPickSql(modules)` (FIFO + prioridad de modulo, `cancel_requested=0`) y luego `CLAIM_BY_ID_SQL`; si no hay fila, repetir. Python usa `contract.sql.claimPickTemplate` y reemplaza `__MODULES__` tras validar contra `contract.modules`.
- **Claim** (`CLAIM_BY_ID_SQL`, CAS por id). Devuelve la fila o **ninguna**: perdiste la carrera, el job tiene `cancel_requested=1`, o (modulos GPU) ya hay otro GPU `running`. Nunca lanza por esos casos; `one_gpu_running` queda como red de seguridad.
- **Heartbeat** (`HEARTBEAT_SQL`) renueva **solo** `lease_until` (~30 s) y devuelve `cancel_requested`. **Sin fila = lease perdido**: el worker deja de trabajar y descarta su output. No toca `deadline_at`.
- **Sweeper** (`SWEEP_SQLS`, cada `SWEEP_MS` y al boot): correr **las dos** sentencias. Son disjuntas, el orden no importa: deadline vencido = `timeout`; lease vencido (o `NULL`) con deadline vigente = `stale`.
- **Transiciones terminales** (`COMPLETE_SQL`, `FAIL_SQL`, `CANCEL_RUNNING_SQL`, `ACK_CANCEL_SQL`) estan guardadas por `status='running' AND claimed_by=:owner`. Sin fila = ya no eres el dueno; no reintentar ni sobrescribir.
- **Cancel** (API): `CANCEL_QUEUED_SQL`; si no devuelve fila, `REQUEST_CANCEL_SQL` (flag cooperativo). El worker lo ve en el heartbeat y responde con `ACK_CANCEL_SQL` (o `CANCEL_RUNNING_SQL` en el dummy/kill).
- En Python usar `fetchall()` con toda sentencia `RETURNING`, para que se ejecute hasta el final.

PRAGMAs: `busy_timeout` **primero** (valor = `LIMITS.SQLITE_BUSY_TIMEOUT_MS`), luego WAL, `foreign_keys=ON`. Escrituras de claim/heartbeat: `BEGIN IMMEDIATE`.

Timestamps: siempre `toISOString()` UTC con `Z`.

## Variables de entorno

Archivo `.env.example` (sin valores reales):

```
STUDIO_HOST=127.0.0.1
STUDIO_PORT=8787
STUDIO_TOKEN=
DATA_DIR=./data
CLOUD_JOBS=0
DAILY_TOKEN_BUDGET=200000
DAILY_STOCK_CALLS=80
PEXELS_API_KEY=
UNSPLASH_ACCESS_KEY=
GSC_CLIENT_SECRET_PATH=
ANTHROPIC_API_KEY=
PIPER_BIN=piper
PIPER_VOICE=
WHISPER_MODEL=small
COMFY_URL=http://127.0.0.1:8188
FFMPEG_BIN=ffmpeg
FFPROBE_BIN=ffprobe
```

Nombres en MAYUSCULAS. Nunca se leen `process.env.FOO` fuera de un modulo `config.ts` / `config.py` que parsea con Zod o pydantic.

## Constantes reutilizables

Importar desde `@faceless/schema`. No copiar numeros.

MODULE_TIMEOUT_SEC, LIMITS.maxQueuedGpu, LIMITS.maxProjectBytes, LIMITS.softProjectBytes, LIMITS.maxImageVariants, LIMITS.POLL_MS, LIMITS.STOCK_CACHE_TTL_SEC, LUFS_TARGET=-14, SEGMENT_SEC_MIN=15, SEGMENT_SEC_MAX=30.

## Idempotencia

Caller envia `idempotencyKey`. Server INSERT o SELECT por `(project_id, idempotency_key)`.
Si existe y el input es igual (hash canonico): se devuelve el job viejo.
Si existe y el input difiere: 409 `idempotency_conflict`.

## Estados

queued → running → done | error | canceled
queued → canceled

No hay paused ni retrying. Un retry es un job nuevo.

## AssembleSpec (minimo v1)

```ts
type AssembleSpec = {
  width: 1920;
  height: 1080;
  fps: 30;
  audioJobId: string;
  captionsJobId?: string;
  clips: Array<{
    fileJobId: string;
    fileKind: "image" | "stock" | "video";
    startSec: number;
    endSec: number;
  }>;
};
```

El worker traduce esto a ffmpeg. La UI no arma filtergraphs.
