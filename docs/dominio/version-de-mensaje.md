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

Desde la feature 038 la acuña OPE a partir de la capa, la clave y el número correlativo de esa clave
en esa capa (`base/<familia>/<valor o ->/<idioma>#<n>`), y nunca se declara: no hay versión del
catálogo entero, hay una por clave. Los identificadores estampados antes, con la voz en el nombre,
siguen identificando lo que se mostró.
