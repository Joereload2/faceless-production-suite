# Spike E0b — `master_16x9.mp4` sin cola

CLI de operador. No lo llama la API ni un worker. Mide Piper + ffmpeg en la maquina owner para calibrar timeouts (PR de schema aparte, solo si p95 supera el umbral del ticket).

`PIPER_VOICE` es **siempre un path de filesystem al `.onnx`**, nunca el id `en_US-lessac-medium`.

## Binario Piper

1. Release Windows de https://github.com/OHF-Voice/piper1-gpl/releases
2. Poner `piper.exe` en PATH, o setear `PIPER_BIN` al path absoluto.

## Voz lessac-medium

1. HuggingFace `rhasspy/piper-voices`, path `en/en_US/lessac/medium/`
2. Copiar `en_US-lessac-medium.onnx` **y** `en_US-lessac-medium.onnx.json` a `data/voices/`
3. Los `.onnx` estan gitignored.

## PowerShell (desde la raiz del repo)

```powershell
cd workers/cpu
py -3.11 -m venv .venv
.\.venv\Scripts\pip install -e . pytest
.\.venv\Scripts\python -m pytest tests/test_segments.py tests/test_ffmpeg_argv.py -q

$env:PIPER_BIN="piper"
$env:PIPER_VOICE=(Resolve-Path "..\..\data\voices\en_US-lessac-medium.onnx").Path
$env:FFMPEG_BIN="ffmpeg"
$env:FFPROBE_BIN="ffprobe"
.\.venv\Scripts\python spike\run_spike.py --data-dir ..\..\data\projects\spike
```

Salida: `data/projects/spike/export/master_16x9.mp4` y `data/projects/spike/timing.json` (gitignored).

Si falta voz o binario: JSON `{"errorCode":"config",...}` y exit 2.

## Protocolo de medicion

Correr **3 veces**. Pegar los `timing.json` en la descripcion del PR (no en schema).

| Step | Si p95 ms | Accion |
|---|---|---|
| piper+loudnorm | > 90000 | PR schema: `MODULE_TIMEOUT_SEC.tts` = `ceil(p95/1000)+30` |
| segs+concat+mix+captions | > 400000 | igual para `assemble` |
| ninguno | — | no tocar schema |

Nunca introducir `k * duration`.
