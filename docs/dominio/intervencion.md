---
es: intervención
en: intervention
contexto: decision
estado: aprobado
fuente: mvp:03-alcance-mvp.md#4.4
---

# intervención -> `intervention`

> Mensajes **curados y versionados**, escritos y revisados por humanos, no generados en tiempo real. Embebidos en el punto de fricción.

En el contrato y en `src/domain/shared-kernel/intervention.ts`, `Intervention` es `{ messageVersionId, anchor, incentive? }` (ADR-026, ADR-027): el anclaje donde se renderiza, la versión del mensaje curado (`msg_<barrera>_<anclaje>_<escalón>_v0` hasta el catálogo de mensajes) y, cuando la política comercial lo concede, el incentivo.
