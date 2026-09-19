---
es: orden
en: order
contexto: identidad
estado: aprobado
fuente: constitucion#VI
---

# orden -> `order`

> `orderId` — Identidad de compra e idempotencia de outcome. Proviene de la plataforma.

Única identidad válida para idempotencia de compra; `eventId` no lo es. Única por merchant, no global. Entra por `POST /v1/orders` como orden verificada (ADR-028).
