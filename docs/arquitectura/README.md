# Arquitectura

Leer junto a [`../plan/01-decisiones-cerradas.md`](../plan/01-decisiones-cerradas.md) y [`decision-v1.md`](./decision-v1.md).

## Topologia v1 (A + contrato de C)

```
[Chrome extension] --JSON--> [Dashboard Vite+React + API Hono+SQLite]
                                    |
                     +--------------+--------------+
                     |              |              |
              worker GPU      worker CPU      stock/GSC
              Comfy image     Piper/Whisper   Pexels
              Comfy video     ffmpeg
              127.0.0.1       127.0.0.1       127.0.0.1
```

- Un consumer GPU. Claim SQL atomico.
- Dashboard unica puerta. Bind loopback. Remoto = Tailscale.
- Job: `packages/schema/job.ts`.

## Stack

| Capa | Eleccion |
|---|---|
| Workspace | pnpm + TS 5 strict + Biome + Vitest |
| Dashboard + API | Vite, React 18, Hono, Drizzle, SQLite, Zod |
| Extension | MV3, Vite CRXJS |
| Imagen / video | Python loop + ComfyUI |
| Voz | Piper + ffmpeg loudnorm -14 LUFS |
| Stock | Pexels (+ Unsplash despues) |
| Subtitulos | faster-whisper small |
| Ensamblador | spec JSON + ffmpeg por segmentos |
| Thumb | Sharp + SVG |
| SEO | cron + GSC + Claude; autoPublish false |

## Lo que no usamos en v1

Streamlit/Gradio como producto, Electron, K8s, LangGraph, scrape 24/7 de YouTube, texto del thumb generado por el modelo, Next, Postgres, n8n.
