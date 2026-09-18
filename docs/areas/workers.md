# Area workers

Dos procesos: `workers/cpu` y `workers/gpu`. Python 3.11. No comparten memoria. Comparten SQLite y `DATA_DIR`.

## CPU (Piper, whisper, ffmpeg, stock, seo)

- Un loop. Puede procesar varios modulos no-GPU.
- Prioridad: cancel flag > tts > captions > assemble > stock > seo.
- ffmpeg y piper: lista de argv + `timeout=timeoutSec`.
- Assemble: segmentos 15–30 s, concat demuxer.
- loudnorm: `I=-14:TP=-1.5:LRA=11`.
- Whisper: modelo `small`.

## GPU (Comfy imagen / video)

- Un consumer. `maxQueuedGpu` se enforcea al crear y al claim.
- Heartbeat cada 10 s.
- Workflow = archivo en `presets/`. Pesos en `comfy-models/` (gitignore).
- Comfy bind `127.0.0.1:8188`.

## Receta de un job

1. `claimJob`.
2. Crear dir `.../<module>/<jobId>/tmp`.
3. Trabajar en `tmp`.
4. Validar output (probe / size > 0 / mime).
5. `fsync` + rename atomico a la ruta final.
6. UPDATE `done` + `output_json` + `bytes_out` + costos.
7. Borrar solo `tmp` propio.

Si falla: UPDATE `error` + `error_code`. No dejar `running`.

## Reglas

1. Cero `shell=True`.
2. Cero leer `.env` fuera de pydantic settings.
3. Cero escribir fuera de `DATA_DIR`.
4. Cero loguear el prompt completo en INFO.
5. Timeout mata el process group.
6. Si los archivos finales ya existen y el status era running recuperado, no rehacer salvo retry explicito.

## Prohibido

Dos instancias GPU. Anthropic desde el worker GPU. Descargar checkpoints en el claim.
