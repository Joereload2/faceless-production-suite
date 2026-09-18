# Suite de produccion — canales faceless

Repositorio de **producto, arquitectura y review**. No hay workers en marcha todavia: esto congela el diseno para poder implementarlo sin mezclar tres orquestadores.

Repo: https://github.com/Joereload2/faceless-production-suite

## Que hay aqui

| Ruta | Que es |
|---|---|
| `docs/producto/01-caracteristicas-apps-y-flujo-faceless.md` | Que hace cada app, contratos JSON, flujo long + Short |
| `docs/arquitectura/02-diseno-tecnico-codigo-y-stack.md` | Stack, monorepo, workers, Compose de referencia |
| `docs/arquitectura/03-tres-propuestas-arquitectura.md` | Propuestas A (local), B (cloud plantilla), C (hibrido) |
| `docs/review/REVIEW.md` | Review de performance, estabilidad y calidad |
| `packages/schema/job.ts` | Contrato Job propuesto (timeouts, idempotencia, engines) |
| `skills/project-reviewer/` | Skill de Grok usado para el review |

## Principio

Cada app hace **una sola cosa**. El dashboard no piensa. Las apps no se pisan.

```
IDEA        → Extension outliers + (opcional) SEO / GSC
GUION       → Claude + skill de tono del canal
VOZ         → App Voz
VISUALES    → Stock + Imagen + Video corto
MONTAJE     → Ensamblador ffmpeg
EMPAQUE     → Thumbnail + ficha YT
PUBLI       → Upload (humano o API tras puerta 2)
APRENDIZAJE → Studio analytics → outliers / SEO
```

## Decision de arquitectura (v1)

1. **Entregar el primer MP4 con la propuesta A** (estudio local: dashboard + cola SQLite de un consumer + Comfy/Piper/ffmpeg).
2. **Congelar el contrato de Job** como si C existiera (`engine`, `timeoutSec`, `idempotencyKey`) para no reescribir el dashboard el dia que haya cloud.
3. **B es un spike de nicho**, no un segundo sistema.
4. **Stock no cambia** entre A/B/C: APIs oficiales + fototeca + `attribution.json`.
5. **Nadie publica solo.** `youtube.publish` no es tool del agente.

## Orden de construccion

1. `packages/schema` + SQLite + tipos Job
2. API: create project / create job / get job (worker dummy)
3. UI: formularios + lista de jobs
4. Worker CPU: Piper + ffmpeg loudnorm
5. Stock: Pexels
6. Extension outliers: extractor + tabla + export
7. Worker GPU: un preset Comfy de imagen
8. Whisper + ensamblador ffmpeg por segmentos
9. SEO: pull GSC + tabla de huecos, sin publicar
10. Video corto
11. Auto-publish / auto-delete: lo ultimo

No empieces por Wan. Voz + outlier + un corte ritmico publican antes.

## Scores del review (specs, no codigo)

| Eje | Score | Tema |
|---|---|---|
| Performance | 3/5 | GPU serializada bien; disco y cola sin techo |
| Stability | 2/5 | Falta timeout, claim de fila, idempotencia |
| Quality | 4/5 | Fronteras claras; tres docs no eligen orquestador |

Detalle en `docs/review/REVIEW.md`.
