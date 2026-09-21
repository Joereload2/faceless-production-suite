# AGENTS.md

Eres un agente de codigo en `faceless-production-suite`.
No tomas decisiones de producto ni de arquitectura. Ejecutas un ticket de
`docs/implement/` (pack v1). Si el ticket no cabe, PARAS y preguntas.

## Orden de lectura (obligatorio, en este orden)

1. `AGENTS.md` (este archivo)
2. `docs/plan/01-decisiones-cerradas.md` — no reabrir
3. El ticket EX que te asignaron
4. `packages/schema/job.ts` + `packages/schema/inputs.ts` + `contract.json`
5. `docs/plan/03-contratos-datos-variables.md` si tocas persistencia
6. `docs/areas/<tu-area>.md`
7. `docs/plan/04-metodo-de-codigo.md`

No leas FacelessCreator, YouToMagic, VisuaLibrary, VigilCut ni `package.yaml`.
Ese ecosistema esta abandonado.

## Nunca

- Reabrir una fila de `01-decisiones-cerradas.md` o `Key Decisions` del pack.
- Inventar un modulo Job sin `packages/schema` + doc 03 **en el mismo PR**.
- Copiar numeros (`LIMITS`, timeouts, SQL) fuera de `@faceless/schema` / `contract.json`.
- Poner secretos en `Job.input`, logs, SQLite, fixtures o `VITE_*`.
- Bind `0.0.0.0`. `CLOUD_JOBS=1`. Electron, LangGraph, n8n, K8s, Wan.
- `child_process` / `subprocess` con string de shell. Siempre argv list.
- Disparar jobs desde `useEffect` de mount.
- Segundo orquestador. El dummy worker usa el mismo SQL de claim.
- Commitear `.onnx`, `.safetensors`, `data/**` (salvo `.gitkeep`), `.env`.
- Tocar un archivo que el ticket no liste (salvo el test que el ticket pide).
- "Mejorar" el alcance del ticket.

## Layout

- `apps/api` Hono + Drizzle + SQLite + dummy-worker TS
- `apps/web` Vite + React 18 (observa, no orquesta)
- `apps/extension` MV3
- `packages/schema` unico sitio de numeros y Zod de inputs
- `workers/cpu` Python 3.11 (Piper, whisper, ffmpeg, stock, seo, script)
- `workers/gpu` Python 3.11 loop + httpx a Comfy
- `workers/thumb` Node Sharp (desde E7b)
- `presets/` workflows Comfy sin pesos
- `channels/demo/` tono + channel.json
- `data/` gitignored
- `docs/implement/` este pack

## Como correr tests (Windows PowerShell, raiz del repo)

```powershell
pnpm install
pnpm -r typecheck
pnpm -r test
pnpm --filter @faceless/schema build:contract
git diff --exit-code -- packages/schema/contract.json
```

Python (desde E3, en `workers/cpu`):

```powershell
.\.venv\Scripts\python -m pytest -q
```

## Que significa Done

1. Typecheck del paquete tocado.
2. Tests del ticket (IDs listados) en verde.
3. Cero orquestador nuevo.
4. Cero secretos viajando.
5. Si tocaste Job/LIMITS/SQL: `packages/schema` + `docs/plan/03-contratos-datos-variables.md` + `contract.json` regenerado en el mismo PR.
6. Checklist DoD del ticket, item a item.

## Windows

- Rutas con `path.join` / `pathlib.Path`. Nunca interpolar `\` en un filtergraph a mano sin el helper de escape.
- Spawn: argv array. Kill: `taskkill /F /T /PID` (ver pack seccion 2.11).
- PowerShell no acepta `&&` en este entorno de agente: comandos separados o `;`.

## Una sesion = un ticket

Si el ticket es ambiguo, STOP. No "inferir". El pack no deberia ser ambiguo.
