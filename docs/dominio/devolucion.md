---
es: devolución
en: return
contexto: medicion
estado: aprobado
fuente: mvp:02-integracion-ecommerce.md#5.4
---

# devolución -> `return`

> Menos urgente que la orden pero necesario para la tercera tesis del producto —calidad de compra—. El requisito es que la devolución se pueda vincular al `orderId`, que ya está en el ledger.

La plataforma avisa que una orden registrada volvió (`POST /v1/returns`): `orderId`, instante
e ítems devueltos opcionales. La orden pasa a `RETURNED` conservando su correlación y su
asignación; los ítems son informativos (el MVP mide calidad de compra por orden, 03 §4.7).
Una devolución por orden, idempotente por `orderId`; de una orden desconocida se rechaza
(`order-unknown`) para que la plataforma reintente después de notificar la orden. Que la
orden volviera no dice que la decisión original fuera incorrecta (01 §5, P11).
