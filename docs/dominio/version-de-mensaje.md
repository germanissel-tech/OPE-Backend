---
es: versión de mensaje
en: message version
contexto: medicion
estado: aprobado
uso: disponible
fuente: mvp:01-arquitectura-mvp.md#5
---

# versión de mensaje -> `message version`

> La entidad `Decision` guarda barrera inferida, evidencia consultada, candidatos, veredicto de política, brazo experimental, versión de configuración y resultado.

Lo que identifica al texto concreto que se mostró, y lo que el ledger registra. **Es inmutable**:
corregir un texto acuña una versión nueva, nunca edita la existente — si el texto de una versión
pudiera cambiar, un cambio del corpus reescribiría lo que el ledger dice que una persona leyó, y con
eso se cae la trazabilidad que el principio IX exige.
