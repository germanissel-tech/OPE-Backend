---
es: condición
en: condition
contexto: decision
estado: aprobado
fuente: docs/adr/026-politica-de-decision-por-merchant.md
uso: disponible
---

# condición -> `condition`

> Reglas «cuando ⟨condición⟩ entonces ⟨barrera, fuerza⟩» sobre el vocabulario cerrado de hechos.

Lo que una regla de la política de decisión (o el riesgo de devolución de la política comercial)
evalúa sobre la sesión y el producto en foco: un **hecho** del vocabulario cerrado
(`eventCount`, `dwellSeconds`, `sequence`, `productAttribute`, `returnedToProduct`,
`variantAvailable`, `sessionAddedToCart`, `sessionEnteredCheckout`) o una combinación con
`all`, `any` y `not`. Un hecho que OPE no captura se rechaza (`unknown-fact`). El contrato
(`Condition`) admite dos niveles de combinadores; el dominio, cualquiera.
