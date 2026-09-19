---
es: correlación pendiente
en: pending correlation
contexto: medicion
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#5.2
uso: disponible
---

# correlación pendiente -> `pending correlation`

> `PENDING_CORRELATION` — hay orden, todavía no hay vínculo verificable. Un dashboard que muestra cero donde en realidad no sabe es peor que uno que muestra "no disponible".

El estado explícito de desconocimiento de una orden verificada: la notificación no trajo el
`sessionId` de OPE, o esa sesión no existe para el merchant. Se muestra como tal; OPE nunca
lo completa por inferencia (el mecanismo C queda fuera del MVP). Una orden pendiente no pasa
a atribuida después: reenviarla "corregida" es un conflicto de idempotencia (ADR-028).
