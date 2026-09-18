---
es: evidencia
en: evidence
contexto: decision
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#4.3
uso: disponible
---

# evidencia -> `evidence`

> Verifica que exista verdad suficiente, **a nivel de la variante exacta**, para sostener el claim que la intervención haría.

La verdad de producto que el plano consultó antes de hablar: si existe, qué frescura tiene por
clase (catálogo; stock y precio) y si la variante en foco está disponible. Sin evidencia
suficiente para lo que la barrera diría, `NO_OP` `evidence-missing`, `evidence-stale` o
`variant-unavailable`. El ledger la conserva en `inference.evidence` (constitución IX).
