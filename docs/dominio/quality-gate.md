---
es: quality gate
en: quality gate
contexto: decision
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#4.4
uso: disponible
---

# quality gate -> `quality gate`

> El Quality Gate es una función pura que valida cada candidato. […] El gate no se relaja nunca para mejorar métricas.

La autoridad que acepta o rechaza cada candidato según haya evidencia de cada claim y el
merchant haya declarado lo que afirma (perfil de evidencia). Motivos de rechazo cerrados;
sin candidato aceptable, `NO_OP` `no-acceptable-candidate`. No conoce techo ni margen: ninguna
configuración lo relaja (ADR-027).
