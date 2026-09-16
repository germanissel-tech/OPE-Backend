---
es: importe
en: money
contexto: ingesta
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#10.2
---

# importe -> `money`

> Hechos comerciales — `orderId`, monto, moneda, ítems, devolución

`Money = { amount, currency }`. El monto viaja como string decimal para no perder precisión (ADR-014); la moneda en ISO 4217.
