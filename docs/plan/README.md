# Plan de implementacion

Documentos de este folder. Son la guia del arquitecto y del PM.

| Doc | Para quien | Pregunta que responde |
|---|---|---|
| [01-decisiones-cerradas.md](./01-decisiones-cerradas.md) | todos | Que ya no se discute en v1 |
| [02-roadmap-etapas.md](./02-roadmap-etapas.md) | PM + implementadores | Que se construye, en que orden, como se cierra |
| [03-contratos-datos-variables.md](./03-contratos-datos-variables.md) | backend + frontend + workers | Nombres, Job, SQL, limites |
| [04-metodo-de-codigo.md](./04-metodo-de-codigo.md) | todos los que commitean | Monorepo, git, estilo, PRs |
| [05-relacion-facelesscreator.md](./05-relacion-facelesscreator.md) | PM + arquitecto | Que se hereda y que se descarta |

Reglas de area: [`../areas/README.md`](../areas/README.md).

**Codigo restante (E0b–E10):** no improvisar. Ejecutar tickets de [`../implement/PACK-V1.md`](../implement/PACK-V1.md). Si el pack y el doc 03 discrepan, gana el pack y el PR de schema actualiza este folder.

## Regla de oro del plan

Si un documento de area contradice `01-decisiones-cerradas.md`, gana `01`.
Si el codigo contradice `packages/schema`, gana el schema y se abre un ADR.
Si alguien quiere Wan, cloud, n8n, Electron, K8s o LangGraph en v1: no. Esta escrito.
