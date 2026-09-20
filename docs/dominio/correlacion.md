---
es: correlación
en: correlation
contexto: medicion
estado: aprobado
fuente: mvp:01-arquitectura-mvp.md#5.2
uso: disponible
---

# correlación -> `correlation`

> Lo que OPE sabe del vínculo entre una orden verificada y una de sus sesiones: `ATTRIBUTED` o `PENDING_CORRELATION`. Se decide una vez, al registrar la orden, y nunca se completa por inferencia. — **DECIDIDO** (2026-09-20, evaluación de los documentos base, decisión 7)

El segundo eje de la respuesta de órdenes y devoluciones, aparte del `status` de la cadena de
evidencia (`VERIFIED_ORDER` → `ATTRIBUTED_ORDER` → `RETURNED`): la cadena dice lo que la
plataforma confirmó; la correlación, si OPE pudo vincularlo a una sesión por el mecanismo A
(`sessionId` conocido del merchant, ADR-028). `ATTRIBUTED` acompaña a `ATTRIBUTED_ORDER` y se
conserva cuando la orden pasa a `RETURNED`; `PENDING_CORRELATION` es el estado explícito de
desconocimiento (ver `correlación pendiente`). Nunca lleva brazo, experimento ni visitante.
