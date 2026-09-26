---
numero: 037
titulo: La fuente separa lo que decide de lo que ejemplifica
estado: aceptada
fecha: 2026-09-25
fuente: sesión con el dueño, 2026-09-25
---

# ADR-037 — La fuente separa lo que decide de lo que ejemplifica

Registra la **enmienda del 2026-09-25** a `01-arquitectura-mvp.md`, `02-integracion-ecommerce.md` y
`03-alcance-mvp.md`, y el criterio con el que se hizo. No es una decisión de arquitectura: es una
decisión de producto del dueño sobre los documentos que prevalecen sobre este repositorio, y se
registra acá por el mismo motivo que ADR-030 registra las cinco de `04`.

## Contexto

D-14 se había registrado diciendo que «el núcleo conoce la vertical»: el vocabulario de OPE nombraba
conceptos de indumentaria. Al arrancar la feature 028 se fue a verificarlo contra la fuente y apareció
lo contrario de lo que la deuda decía.

`01` definía la variante como «la combinación exacta de talle y color», listaba el `AnchorSet` como
«dónde están el selector de talle, el de color…» y nombraba la barrera «talle/calce», marcada
`DECIDIDO`. **El núcleo no se había acoplado a la vertical: estaba implementando la fuente con
fidelidad.** Renombrar sin más habría separado el código de la fuente de verdad #2, que prevalece
sobre el contrato y sobre `specs/`.

Dos cosas más aparecieron en esa lectura:

- **La propia `01` argumentaba a favor del renombre.** La misma tabla del SDK que decía «selector de
  talle» dice, dos filas arriba, que la normalización mínima produce «un vocabulario de eventos
  **estable, independiente de la plataforma**». Un evento llamado por una prenda hace lo contrario de
  lo que esa fila promete.
- **El contrato le debía un anclaje a la fuente.** `01` enumeraba **cinco** puntos de anclaje y el
  contrato publicaba **cuatro**: faltaba el del selector de color.

## Decisión

**Se enmendó la fuente, y recién después el código.** El orden importa y es el que la feature 027
dejó escrito: cuando el diseño y la fuente no coinciden, se corrige el diseño; cuando la fuente ya no
dice lo que el equipo sabe, se la enmienda **antes** de tocar nada.

El criterio que se aplicó pasaje por pasaje, y que queda para la próxima vez:

> En cada párrafo, separar **lo que el documento decide** de **lo que ejemplifica**. Casi siempre la
> decisión es genérica y el ejemplo es del piloto de indumentaria. Cuando es así, la enmienda baja el
> ejemplo a ejemplo y **no cambia ninguna decisión**.

Catorce líneas, en tres clases:

| Clase                                              | Qué se hizo                                                                                                                                                                               |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **La decisión era genérica, el ejemplo era ropa**  | La definición de variante, la verdad a nivel de variante, la captura de señales, el `AnchorSet` y las tablas que los repiten: el concepto queda genérico y la ropa entra entre paréntesis |
| **El nombre era la mitad vertical de un término**  | La barrera «talle/calce» pasa a «calce», que es lo que el código ya implementaba como `fit` desde hacía catorce features sin que molestara                                                |
| **El ejemplo era el piloto hablando, y está bien** | Nueve líneas **intactas**: el rediseño que rompe el selector en Rapsodia, el motivo de que las barreras sean estas tres, el sesgo del cambio en local físico, el checklist del candidato  |

**Lo que no se tocó, a propósito**: `04-hoja-de-decisiones.md`. Es el registro fechado de una
conversación, no una especificación viva, y reescribirlo falsificaría lo que se dijo ese día — la
misma razón por la que las `specs/` anteriores y los informes de auditoría no se reescriben nunca.

## Consecuencias

- **El código de la feature 028 alinea en vez de divergir.** `variant_selector`, el evento del control
  de variante y el bloque `specifications` dicen lo que la fuente dice.
- **La deuda del anclaje faltante desapareció en vez de pagarse**: un `variant_selector` cubre los dos
  selectores que la fuente listaba por separado, así que los cinco lugares de la fuente son cuatro
  nombres del vocabulario y no falta ninguno.
- **La variante genérica quedó permitida y sin resolver** (D-16). La enmienda sacó el impedimento;
  falta la pregunta de diseño, que es cómo el claim de calce sabe cuál de los atributos de una
  variante es el que se recomienda.
- **Las citas del repositorio siguen resolviendo**: las secciones no se movieron, así que
  `check:identifiers` y `check:adrs` no ven nada. Pero **el texto cambió**, y un lector que compare
  una spec vieja con la fuente necesita este ADR para saber cuándo y por qué. Sin él, la enmienda
  sería invisible.
- **La fuente no tiene historia** (D-17): no hay control de versiones en su directorio, así que la
  enmienda se respaldó con una copia fechada a mano (`../*.bak-2026-09-25`). Es mejor que nada y
  bastante peor que un diff.

## Lo que este ADR le pide a la próxima feature

Antes de llamar «deuda» a un acople con una vertical, **verificar si la fuente lo pide**. La tabla de
D-14 se escribió sin abrir `01` y dos de sus cinco filas estaban al revés. Una deuda inventada le
cuesta credibilidad a las que sí existen.
