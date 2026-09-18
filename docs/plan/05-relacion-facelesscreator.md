# Relacion con Joereload2/FacelessCreator

`FacelessCreator` es un prototipo publico anterior (Python, docs de constitucion, UI desktop). Este repo es el estudio faceless que se va a construir.

## Decision

| Tema | Que hacer |
|---|---|
| Fuente de implementacion v1 | **Este repo.** |
| FacelessCreator | No se desarrolla en paralelo. No se porta Electron/desktop. |
| Constituciones utiles | Se heredan principios (abajo), no pantallas ni nombres de tipos (`RenderPlan`, etc.). |
| Codigo Python de FacelessCreator | Se puede leer como referencia de ffmpeg. No se copia el orquestador. |

## Que se hereda (principios)

De `docs/constitution/*` de FacelessCreator, adaptado:

- Solucion mas simple que cubra el fallo conocido.
- Una fuente de verdad por dato.
- UI no coordina transacciones internas.
- Jobs persistidos antes de ejecutar; huerfanos al boot.
- Bytes en filesystem, metadata en SQL.
- Secretos fuera de SQLite y logs.
- Tests con fakes; APIs reales fuera del CI normal.
- ffmpeg por plan reproducible, no por comando improvisado.

## Que no se hereda

- Desktop / Electron.
- Modelo de dominio `RenderPlan` como centro (aqui el centro es `Job` + `AssembleSpec`).
- Cualquier segundo dashboard.
- Alcance app completa de edicion antes del primer master.

## Comunicacion

El README de FacelessCreator deberia, en un PR aparte de ese repo, decir:

> Diseno sucesor: `faceless-production-suite`. No abrir features nuevas aqui.

Hasta que eso ocurra, este documento es la regla para quien aterrice en la cuenta y vea dos repos.
