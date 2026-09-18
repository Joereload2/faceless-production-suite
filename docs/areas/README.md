# Areas

Reglas por rol. Cada archivo es lo que un implementador de esa area tiene que interiorizar.

| Area | Archivo | Entrega |
|---|---|---|
| Producto / PM | [producto.md](./producto.md) | Alcance, puertas, tablero de etapas |
| Frontend | [frontend.md](./frontend.md) | Dashboard observador |
| Backend | [backend.md](./backend.md) | API Hono + SQLite |
| Workers | [workers.md](./workers.md) | CPU y GPU |
| Extension | [extension.md](./extension.md) | Outliers manuales |
| QA | [qa.md](./qa.md) | Matriz de pruebas por etapa |
| Seguridad | [seguridad.md](./seguridad.md) | Bind, secretos, procesos |

Contrato compartido: `packages/schema` y [`../plan/03-contratos-datos-variables.md`](../plan/03-contratos-datos-variables.md).

Nadie inventa un modulo Job sin pasar por schema + ADR.
