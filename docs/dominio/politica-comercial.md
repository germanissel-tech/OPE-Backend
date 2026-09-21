---
es: política comercial
en: commercial-policy
contexto: decision
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#4.5
uso: disponible
---

# política comercial -> `commercial-policy`

> Último filtro y única autoridad que emite el veredicto. Puede bloquear una intervención que el resto del pipeline consideró buena.

Dato del merchant, versionado (`commercialPolicyVersion` en cada decisión): techo, escalones,
margen, riesgo de devolución, alta intención, abandono, presupuesto por sesión, cooldown y
fatiga. Sin margen no sale nada con componente económico. No confundir con la **política de
decisión** (ADR-026), que infiere la barrera.
