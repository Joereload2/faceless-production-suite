# Area extension

Chrome MV3. CRXJS + Vite. Habla con `apps/api` en localhost.

## Responsabilidad

Capturar la vista **actual** de YouTube Studio (outliers) y mandarla al proyecto activo.

## Reglas

1. Un boton. Cero timers de scrape.
2. No guardar cookies de Google. No leer `chrome.cookies`.
3. Si `subscribers` no aparece, `ratio = null`. Nunca estimar.
4. Payload tipado. El API valida de nuevo.
5. Host permissions minimos: Studio + `127.0.0.1`.
6. IndexedDB solo para ultimo projectId. Las tablas viven en SQLite.

## Done de E5

Una persona logueada en Studio pulsa capturar y ve las filas en el dashboard.

## Prohibido

Automatizar login. Content script en youtube.com publico para harvest masivo. Subir a un server que no sea el estudio local.
