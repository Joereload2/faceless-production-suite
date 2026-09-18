# Area QA

QA no es probar a mano al final. Cada etapa del roadmap trae IDs de prueba.

## Capas

| Capa | Donde | Red real | GPU | Cuando |
|---|---|---|---|---|
| Unit | Vitest / pytest | no | no | siempre en CI |
| Integracion | SQLite temp / tmpdir | no (fakes) | no | siempre en CI |
| Smoke | script local | no | no | CI liviano |
| Manual / costoso | maquina de dev | opcional | opcional | nunca CI default |
| E2E | a partir de E7 | fakes | no | CI cuando E7 exista |

## Reglas

1. Un bug de contrato se cubre en la capa mas baja que lo reproduce.
2. No se escribe un test vacio para tener E2E.
3. Pexels, GSC, Claude, Comfy real = manual u opt-in `RUN_LIVE=1`.
4. Fixtures chicos, sin PII, con licencia declarada.
5. Media se valida con ffprobe, no solo exists().
6. El claim concurrente es obligatorio desde E1.
7. Timeout y kill del hijo es obligatorio desde E3.
8. Snapshot de HTML de Studio: anonimizado.

## Matriz de riesgo

- LOW: unit o review.
- MEDIUM: unit + integ.
- HIGH (claim, ffmpeg, disco, auth): unit + integ + smoke.
- ARCHITECTURE (cambiar Job): schema test + doc 03 + review backend y frontend.

## Tests del schema (E0)

`packages/schema/job.test.ts`: timeouts, LIMITS, CLAIM_SQL contiene status queued, defaultTimeout.

## CI minimo (desde E1)

`pnpm -r test` y `pnpm -r typecheck`. Python: pytest de fakes. No Comfy en CI.
