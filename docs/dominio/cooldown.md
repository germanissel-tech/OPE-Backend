---
es: cooldown
en: cooldown
contexto: decision
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#4.5
uso: disponible
---

# cooldown -> `cooldown`

> Cooldown y fatiga. Límites por sesión y por visitante.

`cooldownSeconds`: el mínimo entre dos intervenciones de la misma sesión, contado desde la
última que el ledger aceptó; dentro del cooldown, `NO_OP` `session-budget-exhausted`. Se
conserva el anglicismo del documento del MVP.
