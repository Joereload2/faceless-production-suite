# Area seguridad

Local-first. El estudio no es un SaaS v1.

## Controles cerrados

1. Bind `127.0.0.1` en dashboard, API, Comfy, workers HTTP.
2. Acceso desde otro dispositivo = Tailscale. No ngrok por ahora.
3. `STUDIO_TOKEN` en POST/GET de datos. `/health` publico en localhost ok.
4. `.env` gitignored. `.env.example` sin secretos.
5. Path confinement a `DATA_DIR`.
6. Procesos externos con argv. Timeout. No shell.
7. Logs sin secretos, sin guion completo, sin cookies.
8. `CLOUD_JOBS=0`.
9. Prompt de tono versionado; user text delimitado.

## Amenazas v1

| Amenaza | Mitigacion |
|---|---|
| Comfy abierto en la LAN | bind localhost + no port forward |
| Token en un job o en un log | strip en API + review de logs |
| Path traversal | resolve + prefix check |
| Prompt injection via guion | delimitadores + tono en archivo |
| Extension con cookies Google | no API cookies; captura manual |
| Presupuesto cloud sorpresa | flags off + caps diarios |
| Dos workers GPU pisan disco | claim + maxQueuedGpu |

## Checklist antes del primer worker real

- [ ] lsof muestra 127.0.0.1, no 0.0.0.0
- [ ] `.env` no trackeado
- [ ] `STUDIO_TOKEN` no es changeme en una demo grabada
- [ ] Comfy sin auth esta solo en loopback
