# Area backend

Stack: Hono + Drizzle + SQLite + Zod + `@faceless/schema`. Bind `127.0.0.1`.

## Responsabilidad

HTTP, persistencia, validacion, claim helpers, enforce de limites y presupuesto. No renderiza video.

## Endpoints v1 (E1)

| Metodo | Ruta | Notas |
|---|---|---|
| GET | `/health` | liveness, no chequea Comfy |
| POST | `/projects` | `{ title, channel }` |
| GET | `/projects/:id` | + `bytesUsed` |
| GET | `/projects/:id/jobs` | lista |
| POST | `/projects/:id/jobs` | valida input por modulo |
| GET | `/jobs/:id` | |
| POST | `/jobs/:id/cancel` | queued o running cooperativo |
| GET | `/jobs/:id/files/:name` | stream desde workspace |

Auth: cookie HttpOnly `studio_token` (SPA) o Bearer (curl). 401 usa `errorCode: unauthorized`. Sin token → 401 en todo menos `/health`, `/auth/login` y `/auth/logout`.

## Reglas

1. Validar body con Zod. 400 `validation` si falla.
2. Insertar job `queued` en la misma transaccion que el chequeo de `maxProjectBytes` y `maxQueuedGpu`.
3. Replay de `idempotencyKey` segun plan 03.
4. `CLOUD_JOBS!=1` y `engine=cloud` → 403 `config`.
5. No poner secretos en `input_json`. Si el caller los manda, strip + 400.
6. Cancel: queued → canceled. running → flag; el worker mira entre heartbeats.
7. Archivos: raiz `DATA_DIR/projects/<id>/`. Traversal → 400.
8. `/health` no depende de GPU.
9. Migraciones Drizzle numeradas. Nunca editar una ya aplicada.
10. `config.ts` carga env con Zod al boot. Fail fast.

## Claim

Opcion v1: misma SQLite, workers en la misma maquina, helper `claimJob(module, owner)`. `changes() === 1` o no hay trabajo.

## Errores

```json
{ "errorCode": "budget", "message": "tope diario de stock alcanzado" }
```

## Prohibido

SELECT * de jobs para armar ffmpeg en el API. Servir `.env`. Abrir Comfy desde Hono.
