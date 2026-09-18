# Decisiones cerradas (v1)

Fecha: 18 septiembre 2026.
Autores de este cierre: analisis Grok + ADR `docs/arquitectura/decision-v1.md` + README original.

Reabrir una fila exige un ADR nuevo en `docs/arquitectura/` y una frase en este archivo: estado `reabierto`, fecha, por que.

## Producto

| ID | Decision | No hacer |
|---|---|---|
| P1 | El estudio produce videos faceless para YouTube. v1 termina en un `master_16x9.mp4` local reproducible. | Medir v1 por plataforma SaaS o por auto-publish. |
| P2 | Dos puertas humanas: (1) guion aprobado, (2) master + thumb aprobados. | El agente no tiene tool `youtube.publish`. |
| P3 | Cada modulo hace una sola cosa. El dashboard observa y crea jobs; no orquesta ffmpeg ni Comfy. | God-dashboard. LangGraph. n8n en v1. |
| P4 | Outliers se extraen a mano desde Studio (extension), no con scrape 24/7. | Cron contra YouTube DOM. |
| P5 | SEO es tabla de huecos. `autoPublish = false`. Reloj de 21 dias solo con piso de impresiones. | Borrar videos que siguen subiendo. |
| P6 | Texto del thumbnail lo pinta Sharp/SVG, no el modelo de imagen. | Pedirle letras al checkpoint de Comfy. |

## Arquitectura

| ID | Decision | No hacer |
|---|---|---|
| A1 | Propuesta **A** (estudio local) entrega el primer MP4. | Empezar por B o C. |
| A2 | El contrato Job se escribe **como si C existiera**: `engine`, `timeoutSec`, `idempotencyKey`, `bytesOut`, `canceled`. | Un Job local-only que luego se reescribe. |
| A3 | B es spike de un nicho (un canal, un preset cloud). No tiene dashboard propio. | Segundo sistema. |
| A4 | Un consumer GPU. Claim atomico de fila. Nunca dos Comfy sobre el mismo job. | Cola en memoria. Varios workers GPU sin lease. |
| A5 | SQLite + filesystem. Bytes en disco, metadata en SQL. | Postgres en v1. S3 obligatorio en v1. |
| A6 | Bind `127.0.0.1` para dashboard, API, Comfy, Piper. Acceso remoto = Tailscale. | Port-forward. `0.0.0.0` en LAN. |
| A7 | Stock identico en A/B/C: Pexels + Unsplash + fototeca + `attribution.json`. | Scrapers de stock. Licencias distintas por motor. |
| A8 | Ensamblador = spec JSON + ffmpeg **por segmentos** + concat demuxer. | Un filtergraph gigante. |
| A9 | Polling HTTP cada `POLL_MS` en v1. SSE despues del primer MP4. | Websockets el dia 1. |
| A10 | `Joereload2/FacelessCreator` no es fuente de implementacion. Se pueden citar constituciones. | Implementar los dos repos a la vez. |

## Stack (herramientas ya elegidas)

| Capa | Herramienta | Version objetivo |
|---|---|---|
| Node | Node 22 LTS | la LTS vigente al implementar |
| Package manager | **pnpm** | 9.x |
| Lenguaje UI/API | TypeScript | 5.x, `strict` |
| Bundler UI | Vite | 6.x |
| UI | React 18 | sin Next en v1 |
| API | Hono | ultima estable |
| ORM | Drizzle | SQLite dialect |
| Validacion | Zod | 3.x — fronteras HTTP y Job.input |
| Tests TS | Vitest | 2.x |
| Lint/format TS | Biome | 1.x (una sola tool) |
| Python | 3.11 | venv por worker |
| TTS | Piper | voz fijada por canal |
| ASR | faster-whisper | modelo `small` v1 |
| Loudness | ffmpeg `loudnorm` | -14 LUFS |
| Imagen/video gen | ComfyUI | un preset versionado |
| Thumbs | Sharp + SVG | — |
| Extension | MV3 + CRXJS | Chrome |
| Secretos | `.env` local, nunca en git | ver area seguridad |

Prohibido en v1: Electron, Streamlit/Gradio como producto, K8s, LangGraph, Terraform, framework de agentes.

## Limites numericos

Fuente de verdad: `packages/schema/job.ts` (`LIMITS`, `MODULE_TIMEOUT_SEC`).

| Constante | Valor v1 | Significado |
|---|---|---|
| `maxQueuedGpu` | 3 | Jobs GPU `queued`+`running` a la vez |
| `maxProjectBytes` | 20 GiB | Techo duro por proyecto |
| `softProjectBytes` | 5 GiB | Warning en UI; no bloquea |
| `maxImageVariants` | 4 | Variantes por job `image` |
| `POLL_MS` | 1500 | Intervalo de GET job desde UI |
| `CLAIM_STALE_MS` | timeoutSec * 1000 + 15000 | Running sin heartbeat → recoverable |
| `ratio` | `null` | Si no hay `subscribers` medidos |

Timeouts (s): image 180, video 900, tts 120, captions 300, stock 60, seo 180, assemble 600.

## Costos

| ID | Decision |
|---|---|
| C1 | El Job lleva contabilidad opcional: `costUsd`, `tokensIn`, `tokensOut`, `gpuSec`, `stockCalls`. v1 puede persistir ceros. |
| C2 | `engine=cloud` esta en el tipo y **apagado**. Encenderlo exige flag `CLOUD_JOBS=0` por defecto. |
| C3 | Cap diario blando documentado en `.env.example`: `DAILY_TOKEN_BUDGET`, `DAILY_STOCK_CALLS`. Al superar: el job queda `error` con codigo `budget`. |
| C4 | Video generativo (Wan / clips largos) no entra hasta etapa 9. Timeout 900 s no es invitacion a usarlo en etapa 3. |

## Seguridad

| ID | Decision |
|---|---|
| S1 | Secretos solo en `.env` / keychain. Nunca en `Job.input`, logs, SQLite, fixtures. |
| S2 | Procesos hijos (ffmpeg, piper, comfy) se lanzan con argv estructurado. Cero interpolacion en shell. |
| S3 | Rutas de output dentro de `data/projects/<projectId>/`. Path traversal = 400. |
| S4 | Extension: extractor manual. IndexedDB sin cookies de YouTube. |
| S5 | Prompt de tono = archivo versionado en el repo del canal. El guion del usuario va delimitado, no concatenado al system. |

## Definition of Done transversal

Un cambio esta Done si:

1. Compila / typecheck del paquete tocado.
2. Tests de la etapa (ver roadmap) pasan.
3. No se anadio un orquestador nuevo.
4. Secretos no viajaron.
5. Si toco el contrato Job, se actualizo `packages/schema` **y** `03-contratos-datos-variables.md` en el mismo PR.
