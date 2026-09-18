# Decision v1

1. Primer MP4 con propuesta A (estudio local).
2. Contrato Job como si C existiera (`engine`, `timeoutSec`, `idempotencyKey`, `bytesOut`, `canceled`, costos opcionales).
3. B es spike de nicho, no segundo dashboard.
4. Stock no cambia: APIs + fototeca + attribution.json.
5. Dos puertas humanas: guion y master+thumb. El agente no tiene `youtube.publish`.
6. Bind `127.0.0.1`. Remoto solo por Tailscale.
7. Este repo es la fuente de diseno. `FacelessCreator` no se implementa en paralelo.
8. Poll v1 cada 1500 ms. SSE despues del primer MP4.

## Timeouts por modulo (segundos)

| Modulo | timeoutSec |
|---|---|
| image | 180 |
| video | 900 |
| tts | 120 |
| captions | 300 |
| stock | 60 |
| seo | 180 |
| assemble | 600 |

## Limites

- maxQueuedGpu = 3
- maxProjectBytes = 20 GiB (warning UI a 5 GiB)
- maxImageVariants = 4
- POLL_MS = 1500
- STOCK_CACHE_TTL_SEC = 86400
- ratio = null si no hay subscribers medidos
- CLOUD_JOBS = 0
- LUFS_TARGET = -14
- segmentos assemble = 15–30 s

Fuente ejecutable: `packages/schema/job.ts`.
