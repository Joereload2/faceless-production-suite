# Project review — suite faceless (specs, 18 sep 2026)

Este es el review original sobre los specs 01/02/03 (que no estan en este repo).

Analisis posterior y remediacion:

- [`REVIEW-GROK-2026-09-18.md`](./REVIEW-GROK-2026-09-18.md)
- Plan: [`../plan/README.md`](../plan/README.md)

Se conserva como historial. Varios highs ya estan en tipos en `packages/schema/job.ts`. El runtime sigue abierto hasta E1–E3.

---

Axes: performance / stability / quality
Date: 18 September 2026
Findings: 0 critical / 4 high / 6 medium / 3 low / 2 note

Scores originales: Performance 3/5, Stability 2/5, Quality 4/5.

Fix order original y estado:

1. Extend Job — hecho en tipos; runtime en E1
2. Claim-row queue + GPU lock + boot reconcile — E1
3. Disk/queue caps — E1
4. ratio = null without subscribers — E5
5. Segmented ffmpeg — E7
6. Contract tests — job.test.ts + E1
7. Choose A or C — cerrado: A + contrato C
