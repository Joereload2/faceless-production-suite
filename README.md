# Suite de produccion — canales faceless

Este repo es la **fuente de verdad** del estudio faceless: producto, arquitectura, plan de implementacion y contrato `Job`.

Todavia no hay workers en marcha. El objetivo de v1 es el **primer MP4 local** sin mezclar tres orquestadores.

**Ecosistema viejo abandonado.** YouToMagic, VisuaLibrary, FacelessCreator, VigilCut y `package.yaml` 0.1 **no se implementan ni se extienden**. Esta suite (`Job`, un dashboard observador, workers locales) es el producto. FacelessCreator queda como prototipo historico, no como fuente de codigo.

Repo: https://github.com/Joereload2/faceless-production-suite

## Como leer esto (en este orden)

1. Este README (2 minutos).
2. [`docs/plan/01-decisiones-cerradas.md`](docs/plan/01-decisiones-cerradas.md) — que ya esta decidido. No reabrir sin ADR.
3. [`docs/plan/02-roadmap-etapas.md`](docs/plan/02-roadmap-etapas.md) — que se construye, en que orden, que prueba cierra cada etapa.
4. [`docs/plan/03-contratos-datos-variables.md`](docs/plan/03-contratos-datos-variables.md) — Job, nombres, limites, SQL.
5. [`docs/plan/04-metodo-de-codigo.md`](docs/plan/04-metodo-de-codigo.md) — monorepo, git, estilo.
6. [`docs/areas/`](docs/areas/README.md) — reglas de frontend, backend, workers, extension, QA, seguridad, producto.
7. Reviews: [`docs/review/`](docs/review/).

Si vas a escribir codigo y solo tienes 10 minutos: lee **decisiones** + **area que te toca** + `packages/schema/job.ts`.

## Mapa del repo

| Ruta | Que es |
|---|---|
| `docs/plan/` | Plan PM + arquitectura. Etapas, decisiones, contratos. |
| `docs/areas/` | Reglas por rol. |
| `docs/producto/` | Flujo de producto (indice). |
| `docs/arquitectura/` | Stack, topologia, ADR v1. |
| `docs/review/` | Reviews (specs 18-sep y analisis Grok 18-sep). |
| `packages/schema/` | Contrato Job, limites, SQL de claim, tests de contrato. |

## Principio

Cada app hace **una sola cosa**. El dashboard no piensa. Las apps no se pisan.

```
IDEA        → Extension outliers + (opcional) SEO / GSC
GUION       → Claude + skill de tono del canal   [PUERTA HUMANA 1]
VOZ         → Worker CPU Piper
VISUALES    → Stock + Imagen (+ video corto despues)
MONTAJE     → Ensamblador ffmpeg por segmentos
EMPAQUE     → Thumbnail + ficha YT               [PUERTA HUMANA 2]
PUBLI       → Upload humano (API solo tras puerta 2)
APRENDIZAJE → Studio analytics → outliers / SEO
```

## Decisiones v1 (resumen)

1. Primer MP4 con **propuesta A** (estudio local).
2. Contrato Job como si C existiera (`engine`, `timeoutSec`, `idempotencyKey`).
3. B es spike de nicho, no un segundo dashboard.
4. Stock no cambia: APIs oficiales + fototeca + `attribution.json`.
5. Nadie publica solo. `youtube.publish` no es tool del agente.
6. Este repo reemplaza a `Joereload2/FacelessCreator` como fuente de diseno.

Detalle: [`docs/plan/01-decisiones-cerradas.md`](docs/plan/01-decisiones-cerradas.md).

## Etapas (resumen)

| Etapa | Nombre | Done cuando |
|---|---|---|
| 0 | Verdad del repo | Specs y plan coherentes; schema publicado |
| 1 | Cola | create/get project+job; claim testeado; worker dummy |
| 2 | UI observadora | Formularios + lista; la UI no orquesta |
| 3 | Voz | Piper + loudnorm -14 LUFS → wav |
| 4 | Stock | Pexels + attribution.json |
| 5 | Outliers | Extension manual → tabla → export |
| 6 | Imagen | Un preset Comfy, localhost |
| 7 | Montaje | Whisper + ffmpeg por segmentos → master_16x9.mp4 |
| 8 | SEO | GSC pull + huecos; `autoPublish=false` |
| 9 | Video corto | Un preset, cola GPU |
| 10 | Publish | Humano; API al final |

No se empieza por Wan ni por cloud. Detalle: [`docs/plan/02-roadmap-etapas.md`](docs/plan/02-roadmap-etapas.md).

## Stack cerrado

| Capa | Eleccion |
|---|---|
| Workspace | pnpm + TypeScript 5.x |
| Dashboard | Vite + React 18 |
| API | Hono + Drizzle + SQLite + Zod |
| Schema | `packages/schema` |
| Extension | MV3 + Vite CRXJS |
| CPU | Python 3.11 + Piper + faster-whisper + ffmpeg |
| GPU | Python FastAPI + ComfyUI, un consumer |
| Thumb | Sharp + SVG |
| Stock | Pexels + Unsplash APIs |
| SEO | cron + GSC API + Claude; sin publish |
| Acceso | bind `127.0.0.1` + Tailscale |

## Relacion con FacelessCreator

`Joereload2/FacelessCreator` es un prototipo anterior. **No se implementa en paralelo ni se retoma YTM→VL→FC→VigilCut.** Ver [`docs/plan/05-relacion-facelesscreator.md`](docs/plan/05-relacion-facelesscreator.md).
