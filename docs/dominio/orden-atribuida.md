---
es: orden atribuida
en: attributed order
contexto: medicion
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#5
uso: disponible
---

# orden atribuida -> `attributed order`

> `ATTRIBUTED_ORDER` — Existe correlación verificable entre la orden y una sesión de OPE. **No significa** que OPE la haya causado.

Una orden verificada cuya notificación trae el `sessionId` de OPE que el storefront le adjuntó
al crearla, y esa sesión existe en el ledger del mismo merchant (tiene al menos una
decisión). Hereda el experimento y el brazo que las decisiones de la sesión registran; sin
experimento, queda atribuida a la sesión sin grupo. Se decide al registrar y no cambia
después (ADR-028). El resultado causal no es un estado: surge del análisis entre grupos. En la
respuesta: `status: ATTRIBUTED_ORDER` y `correlation: ATTRIBUTED`; al devolverse, `status`
pasa a `RETURNED` y la correlación se conserva.
