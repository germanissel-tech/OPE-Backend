---
es: fatiga
en: fatigue
contexto: decision
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#4.5
uso: disponible
---

# fatiga -> `fatigue`

> Cooldown y fatiga. Límites por sesión y por visitante.

`interventionsPerVisitorPerDay`: cuántas intervenciones puede recibir un visitante en un día,
entre sesiones; superado, `NO_OP` `visitor-fatigue`. El estado por visitante vive en memoria
con ventana de un día y no cruza merchants.
