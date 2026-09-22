# Clon local de voz (XTTS) — extra, no v1 Piper

El job `tts` no cambia: sale `tts/<jobId>/voice.wav` a −14 LUFS. Si `TTS_ENGINE=clone`, Piper no se usa.

Esto **no** clona a terceros. Solo tu grabacion de referencia.

## 1. Grabacion

- 60–120 s tuyos, un hablante, poco ruido, 16–48 kHz
- WAV o se convierte; path por defecto `data/voices/me.wav`
- Idioma del texto: `en` o `es` en el input del job (`language`)

## 2. Instalar motor (pesado, ~2 GB la primera vez)

```powershell
cd workers/cpu
.\.venv\Scripts\pip install -e ".[clone]"
```

GPU NVIDIA ayuda. CPU funciona, lento.

## 3. Env

```
TTS_ENGINE=clone
CLONE_REF_WAV=C:\Users\jose\faceless-production-suite\data\voices\me.wav
CLONE_LANGUAGE=es
```

Sin `CLONE_REF_WAV`, el worker busca `DATA_DIR/voices/me.wav`. Si falta: `errorCode=config` `"clone reference missing"`. Si falta el paquete `TTS`: `"clone engine missing"`.

## 4. Job

```json
{ "module": "tts", "input": { "text": "Hola desde la biblioteca.", "language": "es" } }
```

Ingles: `"language": "en"` con la **misma** toma si hablas ambos.

## 5. Legal

- La toma es tuya → no usas la voz de lessac/davefx
- YouTube: marca contenido sintetico si el audio lo genera el modelo
- Licencia del modelo XTTS: revisa Coqui/TTS antes de monetizar
