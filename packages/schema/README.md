# @faceless/schema

Unico contrato Job del estudio. UI, API, extension y workers hablan este shape.

- `job.ts` — tipos, LIMITS, timeouts, SQL
- `inputs.ts` — payload por modulo
- `job.test.ts` — pruebas de contrato (Vitest): SQL real, carrera multi-proceso, Python
- `test-support/` — proceso hijo usado por los tests de concurrencia

```ts
import { LIMITS, defaultTimeout, type Job } from "@faceless/schema";
import type { TtsInput } from "@faceless/schema/inputs";
```

No copiar numeros a otros paquetes. Si hace falta un limite nuevo, nace aqui y en `docs/plan/03-contratos-datos-variables.md`.
