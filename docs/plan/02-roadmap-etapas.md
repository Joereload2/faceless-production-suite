# Roadmap por etapas

Una etapa no empieza si la anterior no tiene su prueba de cierre en verde.
El PM no acepta el 80% de la etapa 6 si la etapa 3 no produce un wav.

Duraciones son orden de magnitud para **una persona** que ya conoce el stack. No son contratos de fecha.

## Vista

```
E0 verdad → E0b spike CLI mp4 fixture
         → E1 cola → E2 UI → E3 voz → E3b guion+shotlist
                                  ↓
                     E5 outliers  E4 stock  E6 imagen
                                  ↓
                              E7 montaje = primer MP4 real
                                  ↓
                              E7b empaque (thumb + ficha)
                                  ↓
                     E8 SEO   E9 video corto   E10 publish
```

No recortar **E0b** ni **E3b**. El spike de ffmpeg va **antes o junto** a E1 (riesgo primero).

## E0 — Verdad del repo (esta entrega)

**Meta.** Cualquiera entiende que construir y contra que contrato.

**Incluye**

- Plan + areas + decisiones (estos docs).
- `packages/schema` como unico sitio de limites y tipos.
- Posicion respecto a FacelessCreator.
- Links rotos a specs 01/02/03 declarados como reemplazados por este plan.

**No incluye.** API, UI, workers.

**Cierre.** README apunta aqui. `job.ts` exporta `LIMITS`, timeouts, `CLAIM_BY_ID_SQL`. Un extraño puede explicar A vs C en 5 lineas.

**Pruebas.** Revision humana. CI de contrato (`pnpm -r test`).

## E0b — Spike CLI: primer mp4 fixture (nuevo)

**Meta.** Un `master_16x9.mp4` de fixture **sin cola**: guion txt → Piper → wav → stock/imagen fixture → ffmpeg por segmentos.

**Cierre.** El mp4 se ve/oye; se miden tiempos reales en el hardware (calibrar timeouts). El spike se tira o se convierte en worker E7.

**No recortar.**

## E1 — Cola y API dummy

**Meta.** Persistir proyectos y jobs. Un worker fantasma puede claim + `done`.

**Incluye**

- pnpm workspace: `packages/schema`, `apps/api`.
- Drizzle + SQLite en `data/studio.sqlite` (gitignored).
- Tablas `projects`, `jobs`. Unique `(project_id, idempotency_key)`.
- HTTP: `POST /projects`, `GET /projects/:id`, `POST /projects/:id/jobs`, `GET /jobs/:id`, `POST /jobs/:id/cancel`.
- Worker dummy en proceso aparte: loop claim → sleep 1s → `done` con un txt.
- Reconcile al boot: `running` con heartbeat vencido → `error` codigo `stale`.
- `.env.example`.

**No incluye.** React, Piper, Comfy.

**Cierre.** `curl` crea un job, el dummy lo termina, el segundo claim del mismo id no gana.

**Pruebas (obligatorias)**

| ID | Capa | Que |
|---|---|---|
| E1-U1 | unit | `defaultTimeout('tts') === 120` |
| E1-U2 | unit | payload sin `idempotencyKey` → reject |
| E1-I1 | integ | dos claims concurrentes → un ganador |
| E1-I2 | integ | replay mismo key → mismo `job.id` |
| E1-I3 | integ | boot reconcile marca stale |
| E1-S1 | smoke | API up, migraciones, create+get |

## E2 — UI observadora

**Meta.** Una persona crea un proyecto y ve la lista de jobs.

**Incluye**

- `apps/web` Vite + React. En v1 puede proxificar `/api` al Hono.
- Pantallas: Home (proyectos), Proyecto (form crear job + tabla), Detalle job (status, error, archivos).
- Poll `GET /jobs/:id` cada `POLL_MS`. Boton cancelar.
- Doble submit bloqueado con el `idempotencyKey` visible.

**No incluye.** Players complejos, editor de timeline, drag-and-drop masivo.

**Cierre.** Sin tocar SQL a mano se ve un job dummy pasar de queued → running → done.

**Pruebas**

| ID | Capa | Que |
|---|---|---|
| E2-U1 | unit | el form no dispara job al montar |
| E2-U2 | unit | doble click no crea dos keys |
| E2-S1 | smoke | home renderiza vacio y con un proyecto fixture |

## E3 — Voz (primer valor de audio)

**Meta.** Un job `tts` produce un wav a -14 LUFS.

**Incluye**

- `workers/cpu`: venv, proceso que lee SQLite.
- Piper con voz fijada por canal (`PIPER_VOICE`).
- ffmpeg `loudnorm` I=-14 TP=-1.5 LRA=11.
- Output: `data/projects/<id>/tts/<jobId>/voice.wav`.
- Timeout 120 s: kill process group.
- `bytesOut` persistido.

**No incluye.** Clonacion de voz, ElevenLabs, cloud TTS.

**Cierre.** Un parrafo de fixture sale en wav; `ffprobe` confirma audio; loudness cerca de -14.

**Pruebas**

| ID | Capa | Que |
|---|---|---|
| E3-U1 | unit | argv de piper/ffmpeg no pasa por shell string |
| E3-I1 | integ | fixture texto → wav existe + probe |
| E3-I2 | integ | timeoutSec=1 + sleep fake → status error, hijo muerto |
| E3-S1 | smoke | un job tts real en maquina de dev (manual, no CI) |

CI **no** corre Piper. CI corre el fake.

## E3b — Guion + shot list (nuevo)

**Meta.** Modulo `script` (Claude + tono versionado) produce `script.json` + `shotlist.json`. Puerta 1 sobre este artefacto, con checklist de originalidad.

**Cierre.** Job `script` idempotente; el humano aprueba el artefacto, no un booleano suelto.

## E4 — Stock

**Meta.** Buscar Pexels, guardar archivo + `attribution.json`.

**Incluye**

- Job modulo `stock`. Timeout 60 s.
- Cache clave `source+q+orient` 24 h en disco.
- `attribution.json` por asset: provider, id, author, license, url, savedAt.
- Contador `stockCalls`. Cap `DAILY_STOCK_CALLS`.

**No incluye.** Unsplash todavia (se agrega cuando Pexels cubre el flujo). Scrape.

**Cierre.** Una busqueda library night 16:9 deja mp4/jpg + attribution.

**Pruebas**

| ID | Capa | Que |
|---|---|---|
| E4-U1 | unit | cache key estable |
| E4-I1 | integ | fake HTTP Pexels → archivo + attribution |
| E4-I2 | integ | segunda misma query no llama red |
| E4-I3 | integ | sin API key → error `config`, no exception vacia |

## E5 — Extension outliers

**Meta.** Extraer a mano una tabla desde YouTube Studio y exportarla.

**Incluye**

- `apps/extension` MV3.
- Boton capturar vista actual. Nada de cron.
- Campos: videoId, title, views, vph si esta, subscribers si esta.
- `ratio` = null si `subscribers` falta.
- Export JSON/CSV hacia el dashboard (`POST /projects/:id/outliers`).

**No incluye.** Autopilot, login embebido, leer cookies.

**Cierre.** Una sesion manual llena la tabla del proyecto.

**Pruebas**

| ID | Capa | Que |
|---|---|---|
| E5-U1 | unit | parser fixture HTML/JSON de Studio |
| E5-U2 | unit | ratio null sin subscribers |
| E5-I1 | integ | export → filas en SQLite |

## E6 — Imagen (un preset Comfy)

**Meta.** Un job `image` produce 1–4 PNG con un workflow versionado.

**Incluye**

- `workers/gpu` FastAPI. Comfy en `127.0.0.1:8188`.
- Un archivo `presets/image-v1.json` commiteado (sin pesos).
- `maxImageVariants = 4`. `maxQueuedGpu = 3`.
- GPU lock: si hay un `running` image/video, el siguiente espera en cola.
- Heartbeat `updatedAt` cada 10 s.

**No incluye.** Video. Varios checkpoints. UI de nodos.

**Cierre.** Un prompt de fixture → PNG en el proyecto. Un segundo job no arranca Comfy en paralelo.

**Pruebas**

| ID | Capa | Que |
|---|---|---|
| E6-U1 | unit | reject variants > 4 |
| E6-I1 | integ | fake Comfy → PNG + bytesOut |
| E6-I2 | integ | segundo claim GPU no corre si ya hay running |
| E6-S1 | smoke | preset carga (manual, maquina GPU) |

## E7 — Montaje = meta v1

**Meta.** `master_16x9.mp4` a partir de voz + visuales + spec JSON.

**Incluye**

- Job `captions` (faster-whisper `small`) → srt.
- Job `assemble`: spec JSON (lista de segmentos, in/out, archivo).
- ffmpeg por segmento 15–30 s + concat demuxer.
- Done = existe `export/master_16x9.mp4` y probe ok (video+audio, duracion ±0.5 s).
- Puerta humana 2: la UI marca `approvedMaster=false` por defecto.

**No incluye.** Editor visual tipo CapCut. Publish.

**Cierre.** Fixture de 30–60 s monta. Se puede reproducir el master.

## E7b — Empaque: thumb + ficha (nuevo)

**Meta.** Modulo `thumb` (Sharp + SVG) y ficha YouTube (titulo, descripcion, tags). Puerta 2 sobre master + thumb ligados al artefacto (hash/job id), no a un booleano suelto.

**No recortar.**

**Pruebas**

| ID | Capa | Que |
|---|---|---|
| E7-U1 | unit | spec invalida → 400, no ffmpeg |
| E7-I1 | integ | segmentos fake → concat → probe |
| E7-I2 | integ | whisper fake → srt no vacio |
| E7-S1 | smoke | master fixture (manual) |
| E7-E2E | e2e | proyecto → tts fixture → stock/imagen fake → assemble → master |

E7-E2E es el primer E2E real. No se finge E7 en E2.

## E8 — SEO (sin publish)

**Meta.** Tabla de huecos desde GSC.

**Incluye**

- Job `seo`. Claude solo sobre filas agregadas, no sobre dumps crudos enormes.
- `autoPublish=false` hardcoded.
- Impression floor antes de sugerir borrar o 21 dias.

**Cierre.** Una tabla se ve en UI. Cero uploads.

**Pruebas.** Fake GSC. Contract test del shape. No GSC real en CI.

## E9 — Video corto

**Meta.** Un preset Comfy de clip corto. Misma cola GPU.

**Incluye.** Timeout 900 s. Un preset. Cola compartida con imagen.

**No incluye.** Wan largo. Varios motores.

**Cierre.** Un clip de ≤ 5 s en fixture. Si no hay GPU, la etapa se pospone; no se sustituye por cloud.

## E10 — Publish (ultimo)

**Meta.** Subida humana. API YouTube solo con `approvedMaster=true` y `approvedThumb=true`.

**Incluye.** Checklist en UI. Ningun tool de agente.

**Cierre.** Documentado + boton que abre el flujo oficial. Automatizar es un ADR nuevo (v2).

## Tablero PM (como se reporta)

Cada etapa tiene un issue o una fila:

```
Etapa | Estado | Owner | Bloquea a | Pruebas verdes | Fecha objetivo
```

Estados: `no empezada` | `en curso` | `bloqueada` | `cerrada`.

No hay estado `casi`. Si falta la prueba de cierre, no esta cerrada.

## Que hacer si duele el tiempo

Recortar en este orden:

1. E9 y E10 (ya estan al final).
2. E8.
3. Unsplash (dejar solo Pexels).
4. Variantes de imagen: bajar a 1.

No recortar E1 (cola) ni E3 (voz) ni E7 (master). Sin eso no hay producto.
