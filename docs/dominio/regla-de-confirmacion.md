---
es: regla de confirmación
en: order confirmation
contexto: plataforma
estado: aprobado
fuente: docs/verificacion-documental-plataformas.md#Resumen
uso: pendiente
---

# regla de confirmación -> `order confirmation`

> Qué es «confirmada» cambia por plataforma y por merchant. Es configuración del merchant, no código. — **PROPUESTO** en la verificación documental, adoptado por la feature 044

Los estados de la plataforma en los que una orden traída por `pull` o `subscribe` cuenta como confirmada
(`confirmedOrderStates`). Por `push` no actúa: la plataforma ya decide qué empuja. Una configuración con órdenes
en `pull` o `subscribe` y la lista vacía no se publica, porque ninguna orden entraría y nada lo diría.
