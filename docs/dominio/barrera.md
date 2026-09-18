---
es: barrera
en: barrier
contexto: decision
estado: aprobado
fuente: mvp:03-alcance-mvp.md#4.2
uso: disponible
---

# barrera -> `barrier`

> Una **barrera** es la razón por la que alguien que quería comprar no compra. […] **El MVP atiende estas tres y sólo estas tres.**

Valores del contrato y del kernel (`Barrier`): `fit` (talle y calce), `price` (precio y valor),
`returns` (cambios y devoluciones). La inferencia (01 §4.2) elige **una sola** barrera dominante
a partir de las señales y del estado de la sesión, con una confianza; sin barrera sobre el umbral,
`NO_OP` `barrier-unclear`. En una `Decision` con `outcome: INTERVENE`, `reason` es la barrera.
Una cuarta barrera es alcance de producto, nunca configuración (ADR-026).
