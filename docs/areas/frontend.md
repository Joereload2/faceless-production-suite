# Area frontend

Stack: Vite + React 18 + TypeScript strict. En v1, el dashboard habla solo con `apps/api`.

## Responsabilidad

Crear proyectos, crear jobs, mostrar estado, cancelar, aprobar puertas. Nada mas.

## Reglas

1. **No orquestar.** Cero ffmpeg, cero filesystem, cero Comfy desde el browser.
2. **No disparar jobs al montar.** Todo POST sale de un click o submit.
3. **Idempotencia visible.** El form genera `idempotencyKey` (ulid) antes del POST. Un doble click reusa la key.
4. **La fuente de verdad es GET.** Poll cada `LIMITS.POLL_MS`. Si el poll falla, se muestra error de red; no se inventa un status.
5. **Estados.** Pintar `queued | running | done | error | canceled` con el `error` del server.
6. **Puertas.** Checkboxes `approvedScript`, `approvedMaster`, `approvedThumb`. Publish deshabilitado si alguna es false.
7. **Archivos.** Links de descarga contra la API. No leer `data/` por file://.
8. **Token.** Header `Authorization: Bearer $STUDIO_TOKEN`.
9. **Accesibilidad minima.** Labels en inputs, foco visible, tablas con thead.
10. **Componentes.** Presentacionales vs hooks de API. El hook no calcula loudness ni ratio.

## Pantallas v1 (E2)

- `/` lista de proyectos + crear.
- `/projects/:id` resumen, puertas, crear job, tabla jobs.
- `/jobs/:id` detalle, log corto, archivos de output.

## Buenas practicas

- React Query (o fetch + poll) para GET.
- Zod del input importado de `@faceless/schema`. Nunca un tercer schema en el componente.
- CSS modules.
- Fechas en UTC en datos; display en locale del browser.

## Prohibido

`useEffect(() => { createJob() }, [])`.
Guardar el Job entero en localStorage como verdad.
Hablar con `127.0.0.1:8188` (Comfy) desde el browser.
