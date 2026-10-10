---
es: aviso
en: notice
contexto: plataforma
estado: aprobado
fuente: docs/verificacion-documental-plataformas.md#Resumen
uso: pendiente
---

# aviso -> `notice`

> La notificación de orden es un aviso, no la orden. — **PROPUESTO** en la verificación documental, adoptado por la feature 044

Lo que la plataforma del merchant manda en el modo `subscribe` cuando una orden o una devolución cambia: el
identificador y, si lo tiene, el estado. **Dice qué cambió, no qué es**: OPE lee el detalle por la fuente de
plataforma y registra lo leído, nunca el contenido del aviso. Se autentica con su propia credencial, que sólo
sirve para avisar (ADR-047).

No es un webhook del `push`: el `push` trae los datos y firma el cuerpo; el aviso no trae nada que entre.
