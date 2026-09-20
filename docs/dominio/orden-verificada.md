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

Es el primer estado de la cadena de evidencia y el que la respuesta lleva como `status`
mientras no exista correlación verificable (`VERIFIED_ORDER` → `ATTRIBUTED_ORDER` →
`RETURNED`); si OPE pudo vincularla o no viaja aparte, en `correlation`
(`PENDING_CORRELATION` | `ATTRIBUTED`): dos ejes, lo que la plataforma confirmó y lo que OPE
sabe (evaluación de los documentos base, decisión 7).
