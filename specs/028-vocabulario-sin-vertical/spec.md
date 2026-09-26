# Feature Specification: El vocabulario deja de nombrar una prenda

**Feature Branch**: `028-vocabulario-sin-vertical`

**Created**: 2026-09-25

**Status**: Draft

**Input**: Cierra la parte de **D-14** que es vocabulario, después de enmendar la fuente. Sale de `main`
limpio (`4a95609`, con la 027 mergeada y el CI de `main` en verde).

## Contexto: la fuente cambió primero, y por eso esta feature existe

D-14 se registró el 2026-09-25 diciendo que «el núcleo conoce la vertical». Al ir a verificarlo
apareció que **la vertical estaba en la fuente**: `01-arquitectura-mvp.md` definía la variante como
«la combinación exacta de talle y color», el `AnchorSet` como «dónde están el selector de talle, el de
color…» y la barrera como «talle/calce», marcada `DECIDIDO`. Renombrar el código habría hecho que el
código se separe de la fuente de verdad #2, que prevalece sobre el contrato y sobre `specs/`.

Así que se evaluó la fuente con el dueño, de forma interactiva, y **se la enmendó el 2026-09-25**:
catorce líneas en `01`, `02` y `03`, ninguna decisión cambiada de contenido. En cada caso lo que el
documento **decidía** era genérico y lo que **ejemplificaba** era ropa; la enmienda separó las dos
cosas y bajó la ropa a ejemplo entre paréntesis. Los respaldos quedaron en `../*.bak-2026-09-25`.

Dos hallazgos de esa lectura, que son el motivo de dos de las tres historias:

- **La propia `01` argumentaba a favor del renombre.** La misma tabla del SDK que decía «selector de
  talle» dice, dos filas arriba, que la normalización mínima produce «un vocabulario de eventos
  **estable, independiente de la plataforma**». Un evento llamado por una prenda hace lo contrario.
- **El contrato le debía un anclaje a la fuente.** `01` listaba **cinco** puntos de anclaje —selector
  de talle, selector de color, precio, CTA, políticas— y el contrato publica **cuatro**: faltaba el de
  color. Generalizar los dos selectores en uno cierra esa deuda sin agregar nada, y es lo que la
  enmienda dejó escrito.

**Lo que esta feature NO hace, y por qué**: la variante genérica (`size` y `color` requeridos en el
catálogo) quedó **permitida** por la enmienda pero fuera de alcance, porque no es un renombre —cambia
la forma de lo que un merchant envía y exige decidir cómo el claim de calce sabe cuál de los atributos
de una variante es el que se recomienda—. Se registra como deuda con esa pregunta de diseño escrita.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - El control que elige variante se llama por lo que hace (Priority: P1)

Un integrador conecta OPE a una tienda que no vende ropa. Abre el contrato y encuentra un punto de
anclaje y un evento que hablan de talles. Tiene que decidir qué es el talle de una heladera, y la
respuesta es que no hay ninguno: lo que hay es un control que elige **variante**, que en ropa es el
talle y el color, y en otro rubro es otra cosa. El vocabulario que la fuente promete «estable e
independiente de la plataforma» le está pidiendo traducir su mundo al de otro rubro.

**Why this priority**: es la pieza que la fuente ya nombra genéricamente, la que cierra la deuda del
anclaje faltante, y la que hoy es gratis y mañana no: el contrato lleva `info.x-stability: building`
(ADR-003), así que ningún merchant lo consume y el renombre entra con bump MINOR; después del primer
piloto cada uno de estos nombres es una versión mayor.

**Independent Test**: se puede probar sola. El vocabulario de anclajes y el de eventos no contienen
ningún nombre de prenda, una decisión que antes anclaba junto al selector sigue anclando en el mismo
lugar con el mismo texto, y la cantidad de anclajes que el contrato publica coincide con la que la
fuente lista.

**Acceptance Scenarios**:

1. **Given** el vocabulario de anclajes del contrato, **When** un integrador de otro rubro lo lee,
   **Then** encuentra el nombre del control genérico y ningún concepto de indumentaria.
2. **Given** una sesión que antes producía una intervención anclada junto al selector, **When** llega
   con el evento renombrado, **Then** la barrera de calce se infiere igual, el escalón elegido es el
   mismo y la intervención se ancla en el mismo punto con el mismo texto.
3. **Given** que la fuente lista los puntos de anclaje de una ficha, **When** se cuentan los que el
   contrato publica, **Then** no falta ninguno: un solo control genérico cubre los dos selectores que
   la fuente enumeraba por separado.
4. **Given** el catálogo de mensajes, cuyas familias llevan el nombre del anclaje, **When** el anclaje
   se renombra, **Then** cada texto afectado se sirve con una **versión nueva** y ninguna versión
   existente se edita.
5. **Given** un evento que llega con el nombre viejo, **When** se valida, **Then** se rechaza nombrando
   el campo: el vocabulario es cerrado y no hay período de convivencia que nadie pidió.

---

### User Story 2 - El bloque de la página no nombra una prenda (Priority: P2)

El vocabulario de bloques de la ficha tiene siete miembros. Seis nombran mobiliario de cualquier
página —descripción, reseñas, políticas, precio, galería, CTA— y uno nombra ropa. Ese miembro es el
que la inferencia usa para decidir que hay una duda de calce, así que no es sólo una dirección en la
página: **tiene semántica para la decisión**, y por eso no puede pasar a ser un nombre libre que cada
merchant declare.

**Why this priority**: va después de US1 porque es más chica y porque la fuente nunca lo nombró —el
vocabulario de bloques es enteramente nuestro—, así que no depende de ninguna enmienda. Va antes de
US3 porque sigue el mismo criterio de ADR-036 que US1 y se prueba con el mismo canario.

**Independent Test**: ningún miembro del vocabulario de bloques nombra un concepto de una vertical, y
una sesión que permanecía en ese bloque sigue produciendo la misma barrera con la misma confianza.

**Acceptance Scenarios**:

1. **Given** el vocabulario de bloques, **When** se lee completo, **Then** ningún miembro nombra un
   concepto de indumentaria.
2. **Given** una sesión que permanece en el bloque que antes se llamaba por una prenda, **When** se
   infiere la barrera, **Then** el resultado es el mismo que antes del renombre.
3. **Given** las reglas de la política de decisión que nombran ese bloque, **When** se renombra,
   **Then** las reglas y **sus identificadores** siguen el vocabulario nuevo: un identificador que
   nombra una prenda es la misma deuda con otra ropa.

---

### User Story 3 - El tope de barreras dice lo que significa (Priority: P3)

El esquema de la configuración de un merchant limita a tres las barreras que puede declarar. Ese tope
**confunde dos cosas**: cuántas barreras existen en el MVP —tres, y es una decisión de producto
marcada `DECIDIDO`— y cuántas puede elegir un merchant —que es una política suya—. Hoy coinciden en el
número, y por eso nadie lo nota; el día que exista una cuarta barrera, el esquema va a estar
limitando la elección del merchant por un motivo que no era el suyo.

**Why this priority**: es la más chica de las tres y la única que no es un renombre. Va última porque
el sistema es correcto sin ella: no hay ningún merchant al que el tope le quede chico.

**Independent Test**: se puede explicar en una frase qué limita el esquema, sin usar el número tres
con dos sentidos distintos; y una configuración que declara todas las barreras existentes se acepta.

**Acceptance Scenarios**:

1. **Given** la configuración de un merchant que declara todas las barreras que existen, **When** se
   publica, **Then** se acepta.
2. **Given** una configuración que declara una barrera repetida o ninguna, **When** se publica,
   **Then** se rechaza nombrando el campo, como hoy.
3. **Given** el esquema, **When** alguien lee qué limita, **Then** lo que dice el límite no depende de
   cuántas barreras existan hoy.

---

### Edge Cases

- **Un evento con el nombre viejo** → rechazado nombrando el campo. El vocabulario es cerrado y no hay
  merchants consumiendo el contrato, así que un período de convivencia sería complejidad que nadie
  pidió.
- **Una configuración de merchant publicada con el anclaje viejo** → rechazada nombrando el campo, por
  el mismo motivo; y la semilla del arranque también, porque es la misma lectura.
- **El catálogo de mensajes** → las familias llevan el nombre del anclaje y las versiones son
  **inmutables** (ADR-036): renombrar una familia **acuña versiones nuevas**, nunca edita las viejas.
- **Las especificaciones anteriores y los informes de auditoría** → son históricos y fechados: no se
  reescriben, y el canario del cierre los excluye. Reescribir lo que una feature decidió en su momento
  sería falsificar el registro.
- **Un merchant que hoy declara el anclaje viejo en su mapa** → no existe (ningún merchant consume el
  contrato), y la semilla de prueba se actualiza con el resto.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Ningún miembro del vocabulario de puntos de anclaje DEBE nombrar un concepto propio de
  una vertical.
- **FR-002**: El vocabulario de puntos de anclaje DEBE cubrir todos los puntos que la fuente enumera
  para una ficha de producto, sin que falte ninguno.
- **FR-003**: El evento que reporta la interacción con el control de variante DEBE llamarse por el
  control que describe, no por el atributo que ese control elige en un rubro.
- **FR-004**: Un campo que el evento transporta y que **ninguna autoridad lee** NO DEBE seguir en el
  contrato; si se conserva, la especificación DEBE decir quién lo lee y para qué.
- **FR-005**: Al cambiar el nombre de una familia de mensajes, cada texto afectado DEBE servirse con
  una versión nueva; ninguna versión existente DEBE editarse (ADR-036).
- **FR-006**: Ningún miembro del vocabulario de bloques de la ficha DEBE nombrar un concepto propio de
  una vertical.
- **FR-007**: Las reglas de la política de decisión que nombran un bloque o un tipo de señal DEBEN
  seguir el vocabulario nuevo, **y sus identificadores también**.
- **FR-008**: El esquema de la configuración de un merchant NO DEBE expresar el número de barreras que
  existen como si fuera el número que un merchant puede elegir; el límite que declare DEBE seguir
  siendo cierto el día que exista una barrera más.
- **FR-009**: El renombre NO DEBE cambiar ningún comportamiento observable: la barrera inferida, la
  confianza, el escalón elegido, el punto de anclaje y el texto servido DEBEN ser los mismos antes y
  después para la misma secuencia de señales.
- **FR-010**: Un evento, un mapa de anclajes o una configuración que use el vocabulario viejo DEBE ser
  rechazado nombrando el campo, sin período de convivencia.
- **FR-011**: Al cerrar, el vocabulario viejo NO DEBE aparecer en el código, el contrato ni la
  configuración. Los documentos históricos —`specs/` anteriores, informes de auditoría— quedan
  excluidos a propósito.

### Key Entities

- **Punto de anclaje**: dónde el SDK inserta una intervención. Vocabulario cerrado de OPE, que el
  merchant traduce a su sitio con su mapa de anclajes (patrón «vocabulario cerrado y mapa del
  merchant», ADR-036).
- **Evento del control de variante**: la señal de que el visitante tocó el control que elige variante.
  Distinta del evento que reporta que **eligió** una variante, que resuelve a un identificador del
  catálogo: uno es intención, el otro es un hecho.
- **Bloque de la ficha**: la zona de la página donde el visitante permanece. Vocabulario cerrado de
  OPE porque la inferencia lo lee; el merchant no lo declara.
- **Barreras declarables**: cuáles de las barreras existentes atiende un merchant. Configuración suya,
  no una constante del contrato.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Un integrador de un rubro que no es indumentaria puede leer el vocabulario completo de
  anclajes, eventos y bloques sin encontrar un solo concepto de indumentaria.
- **SC-002**: Para la misma secuencia de señales, la decisión es idéntica antes y después del
  renombre: misma barrera, misma confianza, mismo escalón, mismo anclaje y mismo texto.
- **SC-003**: La cantidad de puntos de anclaje que el contrato publica coincide con la que la fuente
  enumera; hoy no coincide.
- **SC-004**: Cero ocurrencias del vocabulario viejo en el código, el contrato y la configuración,
  verificado por un comando y no por lectura.
- **SC-005**: Qué limita el esquema de barreras declarables se puede explicar en una frase que siga
  siendo cierta si mañana existe una cuarta barrera.

## Assumptions

- **La enmienda de la fuente del 2026-09-25 está aplicada** a `01-arquitectura-mvp.md`,
  `02-integracion-ecommerce.md` y `03-alcance-mvp.md`, con respaldos en `../*.bak-2026-09-25`. Sin
  ella, US1 haría que el código se separe de la fuente.
- **Ningún merchant consume el contrato** (`info.x-stability: building`, ADR-003), así que los
  renombres entran con bump MINOR, `contract:diff` los reporta y los acepta, y el prefijo de versión se
  conserva.
- **No hay nada persistido en el ledger** (decisión del dueño, 2026-09-25): un cambio de vocabulario no
  tiene que migrar nada, y si lo tuviera se puede borrar porque estamos en construcción.
- **El corpus de mensajes es un archivo del release**, así que renombrar familias es un cambio de
  archivo revisado en la PR, no una operación de API (ADR-036).
- **`04-hoja-de-decisiones.md` no se toca**: es el registro fechado de una conversación, no una
  especificación viva.

## Lo que queda registrado como deuda, no resuelto acá

- **La variante genérica**: el catálogo exige hoy dos atributos de indumentaria para cada variante. La
  enmienda de la fuente lo desbloqueó, pero no es un renombre: cambia la forma de lo que un merchant
  envía y exige decidir **cómo el claim de calce sabe cuál de los atributos de una variante es el que
  se recomienda**. Esa pregunta es el trabajo, y se escribe con la deuda.
- **La fuente de verdad no tiene historia**: `../*.md` no está bajo control de versiones. La regla
  «cuando el diseño y la fuente no coinciden, se corrige el diseño» se apoya en documentos que pueden
  cambiar sin que quede registro de qué cambió ni cuándo. Hoy lo cubre una copia fechada a mano.
