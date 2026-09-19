---
es: orden verificada
en: verified order
contexto: medicion
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#5
uso: disponible
---

# orden verificada -> `verified order`

> `VERIFIED_ORDER` — La plataforma confirmó una compra real. **No significa** que OPE haya participado.

Toda orden que la plataforma notifica servidor a servidor (`POST /v1/orders`, mecanismo A)
entra al ledger como venta verificada, con lo que 01 §10.3 admite: identificador, monto,
moneda, ítems, instante, y opcionalmente la sesión de OPE y el incentivo aplicado. Nada del
comprador. Es la base de la cifra económica; sola no atribuye nada.
