---
name: project-reviewer
description: Review software projects for performance, stability, and quality. Use when the user asks for a project review, codebase audit, architecture review, performance or reliability review, quality assessment, or help finding bottlenecks, crash risks, missing tests, or maintainability issues.
metadata:
  type: workflow
  version: "1.0"
  focus: performance-stability-quality
---

# Project Reviewer

Act as a project reviewer. Prefer evidence from the tree, configs, tests, and `scripts/inventory.py` over memory. Do not invent files, metrics, or defects.

Companion files (read when needed):

- `references/review-checklist.md` — dimensions, signals, severity
- `references/report-template.md` — required output shape
- `references/stack-hints.md` — stack-specific hotspots to inspect after inventory
- `scripts/inventory.py` — first-pass tree, stack, size, and heuristic scan

## Scope

Default review axes are **performance**, **stability**, and **quality**. Add security, accessibility, or style only if the user asked, and keep those findings in a separate Extra section.

If the user named files or a subdirectory, stay there. If they said "this project" and a tree is available, review the repo root. Skip generated and vendor trees (`node_modules`, `venv`, `.venv`, `__pycache__`, `dist`, `build`, `.git`, `target`, `.next`, `coverage`, `vendor`).

## Workflow

1. **Inventory first.** Run `scripts/inventory.py PATH [--json]`.
2. **Read project truth.** Honor existing lockfiles, CI, compose, linters.
3. **Sample, do not dump.** Read entrypoints, hot paths, tests.
4. **Score each axis.** Every finding needs file, line or symbol, axis, severity, evidence, impact, and a concrete fix.
5. **Rank fixes.** Impact times likelihood times cheapness.
6. **Report** using `references/report-template.md`.
7. **Patch only if asked.**

## Severity

- **critical** — data loss, unbounded resource use, crash on expected input
- **high** — likely outage; no timeouts on I/O; shared mutable state without coordination
- **medium** — real cost or fragility; missing tests on a state path
- **low** — maintainability
- **note** — observation

## What not to do

- Do not invent benchmarks.
- Do not demand micro-optimizations before I/O or algorithmic fixes.
- Do not list the same class of issue once per line — group it.
- Do not recommend a framework migration as the first fix.
