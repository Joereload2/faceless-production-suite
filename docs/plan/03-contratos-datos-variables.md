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
  approved_script INTEGER NOT NULL DEFAULT 0,
  approved_master INTEGER NOT NULL DEFAULT 0,
  approved_thumb  INTEGER NOT NULL DEFAULT 0
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
  owner            TEXT NOT NULL,
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
  claimed_until    TEXT
);

CREATE UNIQUE INDEX jobs_idempotency ON jobs(project_id, idempotency_key);
CREATE INDEX jobs_status ON jobs(status, updated_at);
```

Mapeo TS ↔ SQL: camelCase en TypeScript, snake_case en SQL. Drizzle es el unico lugar que traduce. Nadie escribe `updatedAt` en SQL crudo salvo las constantes de `packages/schema`.

## Job (campos)

Ver interfaz `Job` en `packages/schema/job.ts`.

Reglas:

- `id` = ulid.
- `idempotencyKey` = string no vacio. Lo genera la UI o el caller. El server no lo reescribe.
- `owner` = obligatorio en create (`api` | `worker-cpu` | `worker-gpu` | `extension` | hostname).
- `engine` = `local` en v1. `cloud` rechazado si `CLOUD_JOBS` != `1`.
- `progress` = 0..1.
- `input` se valida con Zod **por modulo** antes de persistir.
- `error` es mensaje seguro para humanos. `errorCode` es maquina: `timeout` | `stale` | `budget` | `validation` | `io` | `config` | `canceled` | `internal`.

## Modulos

| module | Quien lo corre | Input minimo | Output esperado |
|---|---|---|---|
| `tts` | worker-cpu | `{ text, voice? }` | `voice.wav` |
| `stock` | worker-cpu o api | `{ query, orientation, count }` | archivos + attribution |
| `image` | worker-gpu | `{ prompt, variants 1..4, preset: image-v1 }` | png |
| `video` | worker-gpu | `{ prompt, seconds, preset: video-v1 }` | mp4 corto |
| `captions` | worker-cpu | `{ audioJobId }` | `captions.srt` |
| `assemble` | worker-cpu | `{ spec: AssembleSpec }` | `export/master_16x9.mp4` |
| `seo` | worker-cpu / cron | `{ siteUrl, days }` | tabla huecos en output.meta |

Fuera del Job (tablas propias, no module inventado): outliers, script, thumb, publish.

## SQL de claim y reconcile

```sql
UPDATE jobs
   SET status = 'running', owner = ?, updated_at = ?, claimed_until = ?
 WHERE id = ? AND status = 'queued';

UPDATE jobs SET updated_at = ?, claimed_until = ?
 WHERE id = ? AND status = 'running' AND owner = ?;

UPDATE jobs
   SET status = 'error', error_code = 'stale', error = 'heartbeat expired', updated_at = ?
 WHERE status = 'running' AND claimed_until < ?;
```

El helper de claim **debe** comprobar `changes() === 1`. Si no, no se trabaja.

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
