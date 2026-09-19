---
es: corroboración
en: corroboration
contexto: medicion
estado: aprobado
fuente: mvp:02-integracion-ecommerce.md#5.1
---

# corroboración -> `corroboration`

> **Mecanismo B — Confirmación desde el navegador.** _Corroborante, nunca autoritativo._ El SDK detecta la página de confirmación de compra y reporta el `orderId`.

Lo que el SDK vio en la página de confirmación (`POST /v1/orders/corroborations`): `orderId`,
sesión, visitante e instante. Es evidencia: nunca crea una orden ni la atribuye; sirve como
disparador temprano, como control cruzado del mecanismo A y para medir que la pérdida de
confirmaciones sea equivalente en CONTROL y TREATMENT (02 §5.2). Se une a la orden por
identidad (`orderId` del merchant), en cualquier orden de llegada (ADR-028).
