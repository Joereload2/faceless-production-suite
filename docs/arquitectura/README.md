# Arquitectura

Fuentes:

- `02-diseno-tecnico-codigo-y-stack.md` — stack y topologia
- `03-tres-propuestas-arquitectura.md` — A local / B cloud / C hibrido

## Topologia v1 (propuesta A + contrato de C)

```
[Chrome extension] --JSON--> [Dashboard Vite+React+Hono+SQLite]
                                    |
                     +--------------+--------------+
                     |              |              |
              worker GPU      worker CPU      stock/GSC TS
              Comfy image     Piper/Whisper   Pexels/Unsplash
              Comfy video     ffmpeg
```

- Un consumer GPU. Claim de fila SQL, no dos procesos a la vez.
- Workers en localhost. Dashboard es la unica puerta (Tailscale).
- Job: ver `packages/schema/job.ts`.

## Stack

| Capa | Eleccion |
|---|---|
| Dashboard + API | TypeScript, Vite, React, Hono, Drizzle, SQLite |
| Extension | MV3, Vite CRXJS, IndexedDB |
| Imagen / video | Python FastAPI + ComfyUI |
| Voz | Piper v1 + ffmpeg loudnorm -14 LUFS |
| Stock | Pexels + Unsplash APIs |
| Subtitulos | faster-whisper |
| Ensamblador | spec JSON + ffmpeg por segmentos |
| Thumb final | Sharp + SVG (el modelo no escribe letras) |
| SEO | cron + GSC API + Claude; autoPublish false |

## Lo que no usamos en v1

Streamlit/Gradio como producto, Electron, K8s, LangGraph, scrape 24/7 de YouTube, texto del thumb generado por el modelo de imagen.
