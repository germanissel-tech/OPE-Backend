---
numero: 28
titulo: Cadena de evidencia en el ledger, correlación sólo por la plataforma e idempotencia de outcomes
estado: aceptada
fecha: 2026-09-19
fuente: specs/013-outcomes-ordenes-y-devoluciones/research.md
---

# ADR-028 — Cadena de evidencia en el ledger, correlación sólo por la plataforma e idempotencia de outcomes

## Contexto

El ledger conocía dos estados de la cadena de evidencia (01 §5): `ASSIGNED` (ADR-022) y
`EXPOSED` (ADR-021). Sin `VERIFIED_ORDER`, `ATTRIBUTED_ORDER` y `RETURNED` el MVP no es medible
(03 §10 criterio 6). 02 §5 decide que la orden confirmada por la plataforma servidor a servidor
(mecanismo A) es la única fuente autoritativa, que la confirmación desde el navegador (B) es
corroborante y que la reconciliación diferida (C) nunca es autoridad. 01 §5.2 pide estados
explícitos de desconocimiento; 01 §6 fija `orderId` como única identidad de compra y exige que
el chequeo y el registro de una orden ocurran sin operación asíncrona intermedia. ADR-020 §4
dejó la igualdad de contenido de la idempotencia para esta feature.

## Decisión

1. **Módulo `outcomes`** (`domain/outcomes`, `application/outcomes`; mapa `[shared-kernel,
ledger]`): la autoridad de entrada de compras, devoluciones y corroboraciones. El módulo
   `ledger` sigue siendo el de decisiones y exposiciones; `outcomes` le pide sólo la consulta
   de sesión (`DecisionLedger.bySession`).
2. **Toda orden entra como venta verificada; la correlación es sólo por mecanismo A.** Una
   orden queda `ATTRIBUTED_ORDER` si trae el `sessionId` de OPE y esa sesión tiene al menos
   una decisión en el ledger del mismo merchant; hereda el experimento y el brazo que las
   decisiones registran (sin experimento: atribuida a la sesión, sin grupo). Si no,
   `PENDING_CORRELATION`, visible como tal. Ninguna heurística completa una correlación
   ausente. La correlación se calcula al registrar y la orden es inmutable: una repetición no
   la reevalúa; una "corrección" es un conflicto.
3. **La corroboración del SDK es evidencia, no autoridad.** Se registra por
   `merchant/orderId/sessionId`, nunca crea ni atribuye una orden, se une a ella por identidad
   y sirve para el control cruzado y para medir la pérdida de confirmaciones por brazo.
4. **Idempotencia atómica en el puerto.** `OrderLedger.record` y `recordReturn` deciden
   `recorded | repeated | conflict` dentro del puerto (en memoria, sección síncrona; en
   Postgres, la transacción), comparando con `sameContentAs` sobre **lo que la plataforma
   envió** (identificador, total, ítems ordenados por SKU, instante, sesión, incentivo
   declarado): igualdad canónica del dominio, independiente del JSON. Una devolución por
   orden; `orderId` único por merchant, no global.
5. **La redención del incentivo es un dato, no una validación.** La orden puede declarar el
   incentivo aplicado; OPE lo cruza con la última decisión `INTERVENE` con incentivo de la
   sesión y registra `matched | mismatched | not-applied | not-granted | unverifiable`. Nunca
   rechaza la orden.
6. **El cuerpo de la orden está acotado por diseño** (constitución VII, v1.3.0): identificador,
   total, ítems con SKU y cantidad, instante, sesión e incentivo aplicado. Nada del comprador;
   `additionalProperties: false` rechaza el objeto de orden completo. Nota (2026-09-19,
   auditoría 014 F-062): 01 §10.3 lista seis campos, sin el incentivo; la constitución lo
   admite desde la v1.3.0 porque lo concede OPE y no identifica al comprador. Cerrada el
   2026-09-20 (feature 016): 01 §10.3 lista los siete campos.

## Consecuencias

- El ledger puede explicar cada venta hasta su sesión, brazo, experimento, corroboración,
  redención y devolución (constitución IX); el análisis ITT (feature del portal) sólo lee.
- Un merchant que sólo puede corroborar (sin propagar el `sessionId`) queda con todas sus
  órdenes `PENDING_CORRELATION`: el piloto degradado se ve en el ledger, no se disimula.
- El resultado causal no es un estado del ledger ni una respuesta: nadie puede leer
  "atribuida" como "causada".
- La feature de persistencia hereda el contrato de los puertos: la atomicidad de la idempotencia
  es del store, no del caso de uso.
