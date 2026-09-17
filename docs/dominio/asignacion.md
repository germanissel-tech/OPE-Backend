---
es: asignación
en: assignment
contexto: medicion
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#4.1
uso: disponible
---

# asignación -> `assignment`

> Determina el brazo experimental del visitante. Determinista y estable: el mismo visitante cae siempre en el mismo brazo, sin consultar estado compartido. La asignación se registra en el ledger en el momento en que ocurre, no cuando hay exposición — es lo que después hace posible el ITT.

Estado `ASSIGNED` de la cadena de evidencia. Una por merchant, experimento y visitante; se registra con el primer lote aceptado. Función pura de merchant, experimento, semilla y visitante (ADR-022).
