# Decision v1

1. Primer MP4 con propuesta A (estudio local).
2. Contrato Job como si C existiera (`engine`, `timeoutSec`, `idempotencyKey`).
3. B es spike de nicho, no segundo dashboard.
4. Stock no cambia: APIs + fototeca + attribution.json.
5. Dos puertas humanas: guion y master+thumb. El agente no tiene `youtube.publish`.

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
- maxProjectBytes = 20 GB
- maxImageVariants = 4
- ratio = null si no hay subscribers medidos
