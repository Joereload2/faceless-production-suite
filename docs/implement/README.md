# Pack de implementacion v1

Este folder es lo que un agente de codigo barato tiene que ejecutar. **No pensar producto ni arquitectura.** Un ticket por sesion.

| Archivo | Que es |
|---|---|
| [PACK-V1.md](./PACK-V1.md) | Spec completa: decisiones K1–K40, AGENTS.md, arbol, SQL, HTTP, Zod, tickets E0b–E10, PR plan |
| [`../../AGENTS.md`](../../AGENTS.md) | Constitucion copiada del pack. Se lee primero. |

## Como trabajar

1. Leer `AGENTS.md`.
2. Leer `docs/plan/01-decisiones-cerradas.md` (no reabrir).
3. Tomar **un** PR del plan (abajo). El ticket completo vive dentro de `PACK-V1.md`.
4. Codear solo los archivos que el ticket lista.
5. Correr los tests que el ticket nombra. Parar si el ticket es ambiguo.

## Orden de PRs

```
PR1 E1a (glob)  y  PR2 E0b (glob)  — cualquier orden, ambos quitan workers/*
        ↓
PR3 E1b jobs+claim+dummy
        ↓
PR4 E2 UI observadora
        ↓
PR5 E3 Piper TTS
        ↓
PR6 E3b guion + puerta 1
        ↓
PR7 E4 stock  ∥  PR8 E5 extension  ∥  PR9 E6 imagen
        ↓
PR10 E7 montaje master_16x9.mp4
        ↓
PR11 E7b thumb + ficha
        ↓
PR12 E8 SEO  ∥  PR13 E9 video corto
        ↓
PR14 E10 publish humano
```

No recortar E1b, E3, E7. Unsplash / Data API / FastAPI / cloud / Wan: fuera de v1.

Si este pack y `docs/plan/03-contratos-datos-variables.md` discrepan, gana el pack y el PR de schema actualiza el 03 en el mismo cambio.
