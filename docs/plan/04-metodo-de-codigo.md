# Metodo de codigo

## Layout del monorepo (a crear desde E1)

```
apps/web/                 # Vite + React
apps/api/                 # Hono + Drizzle
apps/extension/           # MV3
packages/schema/          # tipos y constantes — ya existe
workers/cpu/              # Python 3.11 Piper / whisper / ffmpeg / stock
workers/gpu/              # Python 3.11 loop + httpx Comfy (no FastAPI)
docs/                     # este arbol
data/                     # gitignore
presets/image-v1.json     # workflows Comfy sin pesos
```

Raiz:

- `package.json` privado, scripts `pnpm -r`
- `pnpm-workspace.yaml` con `apps/*` y `packages/*`
- `biome.json`
- `tsconfig.base.json` strict
- `.env.example`

Python no vive en pnpm. Cada worker tiene `pyproject.toml` + `.venv` local.

## Git

- Branch `main` siempre desplegable como docs + contrato.
- Feature: `feat/e1-api-jobs`, `fix/claim-race`.
- Commits cortos, imperativo: `feat(api): claim job with rowcount`.
- Un concern por PR. No mezclar meto Comfy con renombro el schema.
- Si tocas `packages/schema`, el PR actualiza `docs/plan/03-contratos-datos-variables.md`.

## TypeScript

- `strict: true`. No `any` en fronteras publicas. `unknown` + Zod.
- Imports: schema primero, luego third-party, luego relativo.
- Nombres: `camelCase` valores/funciones, `PascalCase` tipos, `SCREAMING_SNAKE` solo reexportadas de schema si son constantes de dominio.
- Errores HTTP: `{ errorCode, message }` alineado al Job.
- Nada de `eval`, nada de `child_process` con string de shell.

## Python

- 3.11. Ruff + format.
- Type hints en funciones publicas.
- `subprocess.run([...], check=False, timeout=...)` con lista.
- Un `config.py` pydantic. Cero `os.environ` sueltos en workers.

## Frontend

- La UI no importa `workers/*` ni llama a ffmpeg.
- Estado de servidor = React Query o fetch + poll. No un store global de jobs paralelo a SQLite.
- Componentes no disparan jobs en `useEffect` de mount.
- Textos de UI en espanol. Codigos de error en ingles estable.

## Backend

- Validar con Zod en la frontera. Despues el dominio fia del tipo ya parseado.
- Transaccion: persistir job `queued` **antes** de avisar al worker.
- No afirmar `done` sin `bytesOut` y archivos listados.
- Logs estructurados (nivel, jobId, projectId, module). Cero texto de guion, cero keys.

## Workers

- Loop: claim → heartbeat → trabajo → fsync+rename → COMMIT `done`.
- Si el proceso muere, E1 reconcile limpia.
- Presets y voces se versionan por nombre (`image-v1`, `PIPER_VOICE`). No el ultimo archivo que habia en Downloads.

## Que no se mergea

- `engine=cloud` activo.
- Bind `0.0.0.0`.
- Segundo orquestador.
- Pesos `.safetensors` / voces `.onnx` en git.
- Secrets.
- Un filtergraph ffmpeg de 80 filtros porque total anda.
