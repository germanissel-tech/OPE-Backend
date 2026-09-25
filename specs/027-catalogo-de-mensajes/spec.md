# Feature Specification: El catálogo de mensajes — lo que OPE muestra deja de ser un placeholder

**Feature Branch**: `027-catalogo-de-mensajes`

**Created**: 2026-09-24

**Status**: Draft

**Input**: Evaluación con el dueño del 2026-09-24 y decisión del stakeholder (German Issel) del
mismo día. Hito `message-catalogue` del roadmap de `contracts/api-map.yaml`.

## Contexto

Hoy una intervención no lleva texto. `src/domain/selection/candidate.ts` acuña
`msg_<barrera>_<anclaje>_<escalón>_v0` y su propio comentario dice que eso dura «hasta la feature
del catálogo de mensajes». El SDK recibe un identificador que no resuelve a nada: **el plano de
decisión funciona entero y no se ve**.

Esta feature lo cierra, y lo hace bajo la restricción que 03 §4.4 impone y que el stakeholder
reiteró por su cuenta: los mensajes son **curados, escritos y revisados por personas**, y
**«si vamos mensaje por prenda y características ahora no salimos más»**.

### Lo que se decidió, y no se vuelve a discutir

| Decisión                                         | Quién                    | Consecuencia                                                                   |
| ------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------ |
| Los textos los escribe OPE, no el merchant       | Dueño, 2026-09-24        | El corpus es un activo de OPE, reusable entre merchants                        |
| No se redacta un mensaje por producto            | Dueño, 2026-09-24        | La redacción no puede crecer con el conteo de SKUs                             |
| El texto se arma con la información del catálogo | German Issel, 2026-09-24 | Dos productos dicen cosas distintas cuando **difieren en valores de atributo** |

De la tercera se sigue el mecanismo: **OPE declara un vocabulario cerrado de valores de atributo
sobre los que sabe hablar y escribe prosa curada para cada uno; el merchant traduce sus etiquetas a
ese vocabulario.** Es el mismo patrón que `AnchorMap` ya usa con los anclajes — OPE tiene el
vocabulario chico y fijo, cada tienda mapea su mundo sobre él.

**El valor crudo del merchant no se muestra nunca.** Los atributos del catálogo son texto libre
—el esquema dice, literalmente, «as the platform exposes them; no normalisation»— y mostrarlos
sería publicar copy del merchant que nadie revisó, con afirmaciones que OPE no puede sostener. Eso
contradice 03 §4.4 («un solo claim inventado invalida el mensaje entero») y pasa por encima del
quality gate, que hoy comprueba que la clave del atributo exista y esté autorizada pero **no mira
su valor**.

### El ejemplo que fijó el alcance

Una tienda de ropa con 3 categorías, 12 productos y 7 etiquetas de tela distintas (dos variantes de
denim, lino repetido en tres categorías, dos telas que OPE no conoce):

|                                         | Cuánto |
| --------------------------------------- | -----: |
| Productos                               |     12 |
| Frases que escribe OPE                  |      4 |
| Líneas que configura la tienda          |      5 |
| Textos redactados producto por producto |  **0** |

Los productos con tela no mapeada no hablan de tela y caen al escalón de abajo — que es lo que el
quality gate ya hace. **Las tres categorías no intervienen en ningún paso**, y por eso esta feature
no construye el concepto de categoría.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - El SDK muestra un texto real (Priority: P1) 🎯 MVP

Una persona entra a una ficha de producto, duda, y OPE decide intervenir. Hoy el SDK recibe
`msg_fit_size_selector_evidence_v0` y no tiene nada que renderizar. Con esta historia recibe **el
texto que una persona de OPE escribió y revisó**, listo para mostrar en el anclaje que le
corresponde.

Incluye el corpus con su estructura completa —texto por familia de mensaje, idioma y voz— aunque
el inventario arranque con **una sola voz**. La clave existe desde el día uno porque, con textos
escritos por OPE, una voz es un activo reusable y agregar la segunda tiene que ser una entrada más,
no un rediseño.

**Why this priority**: es la feature. Sin esto el plano de decisión entero —cinco autoridades, tres
barreras, la escalera de incentivos— produce un resultado que nadie puede ver. Entregar sólo esta
historia ya vuelve visible todo lo construido.

**Independent Test**: provocar una intervención y comprobar que la respuesta lleva un texto
mostrable, no un identificador; y que una familia sin texto en el corpus responde
`message-unavailable` y **no** se confunde con un `NO_OP`.

**Acceptance Scenarios**:

1. **Given** un merchant con su voz e idioma configurados y el corpus publicado, **When** el plano
   decide intervenir con una familia que tiene texto, **Then** la respuesta lleva el texto curado y
   el anclaje donde mostrarlo.
2. **Given** la misma situación pero sin texto para esa familia en ese idioma, **When** el plano
   decide intervenir, **Then** la respuesta lo declara como `message-unavailable` con su motivo, y
   el registro de la decisión distingue ese caso de una decisión de callarse.
3. **Given** una decisión que se mostró, **When** se lee su registro, **Then** consta **qué versión
   de texto** se mostró, para que los resultados puedan atribuirse a lo que la persona leyó.

---

### User Story 2 - Dos productos dicen cosas distintas según sus atributos (Priority: P2)

La remera blanca común y la remera de algodón peinado tienen que decir cosas distintas, **sin que
nadie redacte un texto para cada una**. La que trae el dato habla de la tela; la que no, no.

Incluye tres cosas: el vocabulario cerrado de valores sobre los que OPE sabe hablar, la prosa
curada de OPE para cada valor, y el mapeo con el que el merchant traduce sus etiquetas.

**Why this priority**: es la decisión del stakeholder y lo que hace que el catálogo escale. Sin
esto, todos los productos de una tienda dicen lo mismo.

**Independent Test**: cargar dos productos que difieren sólo en un valor de atributo mapeado y
comprobar que reciben textos distintos; agregar productos nuevos cuyos valores ya están mapeados y
comprobar que funcionan **sin redactar nada**.

**Acceptance Scenarios**:

1. **Given** dos productos que difieren sólo en el valor de un atributo, ambos mapeados al
   vocabulario de OPE, **When** el plano interviene sobre cada uno, **Then** cada uno recibe el
   texto curado de su valor.
2. **Given** un producto que no trae el atributo, **When** el plano evalúa el candidato que lo
   afirma, **Then** ese candidato se rechaza y la decisión cae al escalón de abajo — el producto no
   habla de eso.
3. **Given** un producto cuyo valor de atributo el merchant no mapeó, **When** el plano interviene,
   **Then** se comporta igual que si no trajera el atributo: no habla de eso, y nunca muestra la
   etiqueta cruda del merchant.
4. **Given** dos etiquetas distintas del merchant mapeadas al mismo valor de OPE, **When** el plano
   interviene sobre productos de cada una, **Then** ambos reciben el mismo texto.
5. **Given** un merchant que intenta mapear una etiqueta a un valor que OPE no conoce, **When**
   publica su configuración, **Then** la publicación se rechaza nombrando el valor desconocido.

---

### User Story 3 - El idioma resuelve por cadena, no por salto único (Priority: P3)

Una tienda sirve `es-AR` y `es-MX`, y el corpus tiene textos en `es-419`. Hoy la configuración
admite **un solo idioma de repliegue**, así que una variante regional sin texto propio salta
directamente al final en vez de probar la variante más cercana.

**Why this priority**: es lo que hace que las variantes regionales sean útiles en vez de decorativas.
Sin la cadena, tener `es-AR` y `es-419` en el corpus no sirve de nada.

**Independent Test**: pedir una decisión con un idioma de página que no tiene texto propio y
comprobar que resuelve al más cercano de la cadena antes de rendirse.

**Acceptance Scenarios**:

1. **Given** una cadena declarada y una página en un idioma sin texto propio, **When** el plano
   interviene, **Then** se usa el texto del primer idioma de la cadena que tenga uno.
2. **Given** una página cuyo idioma agota la cadena sin encontrar texto, **When** el plano
   interviene, **Then** responde `message-unavailable` — **nunca** un texto en otro idioma.
3. **Given** una página que no declara idioma, **When** el plano interviene, **Then** se usa el
   idioma por defecto del merchant.

---

### User Story 4 - El merchant se entera de lo que le falta mapear (Priority: P4)

Un merchant agrega una línea de productos con una tela que no mapeó. Todo funciona: esos productos
simplemente no hablan de tela. **Y nadie se entera.** OPE deja de intervenir en media tienda en
silencio.

Esta historia hace visible ese hueco: qué valores aparecieron en el catálogo sin mapeo, desde
cuándo y a cuántos productos afecta, leíble por un operador.

**Why this priority**: es lo que evita que el catálogo se degrade sin que nadie lo note. Va última
porque el sistema es correcto sin ella — sólo que ciego.

**Independent Test**: publicar un catálogo con un valor sin mapear y comprobar que aparece en el
reporte con su conteo; comprobar que el reporte nunca rechaza ni bloquea nada.

**Acceptance Scenarios**:

1. **Given** un catálogo con productos cuyo valor de atributo no está mapeado, **When** un operador
   consulta el reporte del merchant, **Then** ve cada valor sin mapear con cuántos productos lo
   traen y desde cuándo.
2. **Given** un merchant que después mapea ese valor, **When** consulta de nuevo, **Then** el valor
   deja de figurar como pendiente.
3. **Given** una cantidad de valores sin mapear mayor al tope que el sistema conserva, **When**
   llega uno nuevo, **Then** se descarta el más viejo y **nunca** se rechaza la ingesta del
   catálogo.

---

### Edge Cases

- **El plano elige una familia que el corpus no cubre** → `message-unavailable`. Es el caso que no
  puede confundirse con `NO_OP`: uno dice «no tengo qué mostrar», el otro «decidí no hablar», y
  mezclarlos arruina la medición.
- **El merchant autorizó el atributo pero OPE no tiene texto para ese valor** → el candidato que lo
  afirma no se usa; se cae al escalón de abajo.
- **El merchant no autorizó el atributo** → ya resuelto hoy: el candidato se rechaza por falta de
  autorización, antes de llegar al texto.
- **El valor del atributo trae copy de marketing** («Algodón premium insuperable») → no se muestra
  nunca; o mapea a un valor de OPE y se usa la prosa de OPE, o no habla de eso.
- **Un producto con dos atributos mapeados que compiten** → hay que decidir un orden determinista;
  nunca dos textos superpuestos en el mismo anclaje.
- **El corpus cambia entre la decisión y el registro** → la decisión guarda la versión que mostró,
  no una referencia que pueda resolverse distinto después.
- **La tienda declara un idioma que el corpus no cubre en ninguna voz** → `message-unavailable`,
  y el merchant lo ve en su reporte.

## Requirements _(mandatory)_

### Functional Requirements

**El corpus y su autoría**

- **FR-001**: Todo texto que un visitante puede llegar a ver DEBE haber sido escrito y revisado por
  una persona antes de estar disponible. El sistema NO DEBE generar, componer ni derivar texto en
  tiempo de ejecución.
- **FR-002**: El corpus DEBE estar versionado, y cada texto DEBE ser identificable por su versión.
- **FR-003**: El corpus DEBE estar organizado por familia de mensaje, idioma y voz. La voz DEBE
  existir como clave aunque el inventario inicial tenga una sola.
- **FR-004**: El contenido provisto por el merchant NO DEBE aparecer nunca en un texto mostrado.

**Lo que decide qué texto se muestra**

- **FR-005**: El sistema DEBE declarar un vocabulario cerrado de valores de atributo sobre los que
  tiene prosa curada. Un valor fuera de ese vocabulario no existe a efectos del mensaje.
- **FR-006**: Un merchant DEBE poder declarar la correspondencia entre sus propias etiquetas y los
  valores del vocabulario, y varias etiquetas suyas DEBEN poder corresponder al mismo valor.
- **FR-007**: Una correspondencia que nombre un valor fuera del vocabulario DEBE ser rechazada al
  publicarse, nombrando el valor desconocido.
- **FR-008**: Cuando un producto trae un atributo cuyo valor corresponde a un valor del
  vocabulario, el mensaje que lo afirma DEBE usar la prosa curada de ese valor.
- **FR-009**: Cuando un producto no trae el atributo, o su valor no corresponde a ninguno del
  vocabulario, el mensaje que lo afirma NO DEBE usarse, y la decisión DEBE caer al escalón
  inmediatamente inferior de la escalera.
- **FR-010**: La elección del texto DEBE depender **sólo** del producto en foco, del idioma de la
  página y de la configuración del merchant. NO DEBE depender de ningún rasgo de la persona.
- **FR-011**: Cuando más de un mensaje resulte aplicable en el mismo anclaje, el sistema DEBE
  elegir uno de forma determinista y mostrar exactamente uno.

**Idioma y voz**

- **FR-012**: El idioma DEBE resolverse antes que la voz. El sistema NO DEBE mostrar nunca un texto
  en un idioma distinto del que resolvió.
- **FR-013**: Un merchant DEBE poder declarar una **cadena** de idiomas de repliegue, recorrida en
  orden, y no un único idioma alternativo.
- **FR-014**: Cuando la página no declara idioma, DEBE usarse el idioma por defecto del merchant.
- **FR-015**: Cuando la voz configurada no tiene texto para la familia y el idioma resueltos, DEBE
  usarse la voz por defecto antes de rendirse; un texto fuera de voz es aceptable, uno fuera de
  idioma no.

**Cuando no hay texto**

- **FR-016**: Cuando el plano decide intervenir y no hay texto aplicable, el sistema DEBE
  responderlo como una condición propia y distinguible, y NO DEBE presentarlo como una decisión de
  no intervenir.
- **FR-017**: El registro de la decisión DEBE permitir contar por separado las intervenciones que
  se mostraron, las que no tuvieron texto y las decisiones de callarse.

**Lo que se registra**

- **FR-018**: Cada decisión que intervino DEBE registrar **qué versión de texto** se mostró, de modo
  que un resultado pueda atribuirse a lo que la persona efectivamente leyó.
- **FR-019**: El registro NO DEBE incorporar el texto de forma que un cambio posterior del corpus
  altere lo que consta que se mostró.

**Visibilidad de lo que falta**

- **FR-020**: El sistema DEBE conservar, por merchant, qué valores de atributo aparecieron en su
  catálogo sin correspondencia declarada, desde cuándo y a cuántos productos afecta.
- **FR-021**: Ese registro DEBE tener un tope; alcanzado el tope se descarta lo más viejo y NUNCA se
  rechaza ni se demora la ingesta del catálogo.
- **FR-022**: Un operador DEBE poder leer ese registro para un merchant.

**Lo que el SDK recibe**

- **FR-023**: La respuesta de una intervención DEBE llevar el texto a mostrar, sin requerir una
  consulta adicional antes de renderizar.
- **FR-024**: La respuesta NO DEBE llevar nunca la barrera inferida, el brazo, el experimento, la
  política, el margen ni el escalón: las reglas de exposición vigentes se conservan sin cambios.

### Key Entities

- **Texto curado**: una pieza de prosa escrita y revisada por una persona, con su versión. Es la
  unidad que se muestra y la que queda registrada.
- **Familia de mensaje**: la combinación de barrera, anclaje y escalón que el plano de decisión ya
  elige hoy. El catálogo no la inventa: la viste.
- **Voz**: el registro de marca con el que está escrito un texto. Un activo de OPE, reusable entre
  merchants; el merchant elige una.
- **Valor de atributo**: un concepto del vocabulario cerrado de OPE sobre el que existe prosa
  curada (por ejemplo, un tipo de tela). No es la etiqueta del merchant.
- **Correspondencia de valores**: la traducción que declara un merchant entre sus etiquetas y los
  valores del vocabulario. Varias etiquetas suyas pueden apuntar al mismo valor.
- **Cadena de idiomas**: el orden en que un merchant quiere que se busque un texto cuando el idioma
  de la página no tiene uno propio.
- **Valor pendiente de mapear**: un valor que apareció en el catálogo de un merchant sin
  correspondencia, con su conteo y su último instante.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Ninguna intervención que llega a una persona lleva un identificador sin texto: el
  placeholder desaparece por completo.
- **SC-002**: En la tienda del ejemplo —12 productos, 3 categorías, 7 etiquetas de tela— se
  redactan **cero** textos por producto, y todos los productos con tela mapeada muestran la prosa
  curada que les corresponde.
- **SC-003**: Agregar productos nuevos cuyos valores ya están mapeados no requiere redactar ni
  configurar nada: **cero** intervención humana por producto.
- **SC-004**: **Cero** textos mostrados contienen contenido provisto por el merchant.
- **SC-005**: Un operador puede saber, para cualquier merchant, qué valores le faltan mapear y a
  cuántos productos afecta, sin pedir nada a nadie.
- **SC-006**: Las intervenciones sin texto y las decisiones de no intervenir se cuentan por
  separado: el 100 % de los casos sin texto es distinguible en el registro.
- **SC-007**: El 100 % de las decisiones que intervinieron registran la versión del texto que
  mostraron, y esa versión sigue diciendo lo mismo aunque el corpus cambie después.
- **SC-008**: Agregar una voz nueva al inventario no obliga a cambiar la estructura del corpus ni la
  configuración de ningún merchant existente.

## Assumptions

- **El primer atributo del que OPE sabe hablar es la composición o tela del producto**, porque es
  el que el stakeholder usó para fijar el alcance. El vocabulario arranca con los pocos valores para
  los que exista prosa curada y crece por demanda, con la misma disciplina con la que se acotaron
  las barreras, los anclajes y los escalones.
- **El inventario de voces arranca con una sola, neutra.** La clave existe igual desde el primer
  día para que la segunda sea una entrada y no un rediseño.
- **El texto es prosa completa por valor, no una plantilla con huecos.** Una plantilla rompe la
  concordancia gramatical en castellano y lee a ficha técnica, que es lo contrario de un mensaje
  curado. Queda anotado para que el plan lo confirme o lo revise.
- **La respuesta de la intervención lleva el texto.** Hoy el contrato dice que el texto «lo sirve el
  catálogo de mensajes, no este contrato», lo que supone una consulta adicional antes de renderizar.
  Esta spec asume lo contrario —texto en la respuesta— y por lo tanto **esa descripción del contrato
  tiene que cambiar**; el plan lo confirma.
- **El mapeo de valores es configuración del merchant** y entra por el mismo camino que el resto de
  su configuración, que ya existe y ya está versionado.
- **La redacción y revisión del corpus es trabajo de OPE fuera de esta feature.** Lo que esta feature
  entrega es la estructura, la resolución y el corpus inicial mínimo necesario para probarla.

## Out of Scope

- **Un texto redactado por producto.** Decisión del stakeholder: contradice «curados y revisados por
  humanos» — nadie revisa mil textos. **Diferido, no descartado** («después iremos viendo el
  proceso»): el diseño no debe cerrarle la puerta, pero tampoco pagar hoy por él.
- **El concepto de categoría y su mapa.** Evaluado y descartado: el caso que lo motivaba —un
  candidato que no aplica a una categoría— ya lo resuelve la evidencia, porque el producto no trae
  el dato y el candidato se rechaza. Es un concepto entero que no hace falta construir.
- **Un lenguaje de condiciones sobre atributos.** Evaluado y descartado: con la decisión de no
  redactar por producto, es potencia que sólo habilita lo prohibido.
- **La voz como brazo de experimento.** Medir qué voz convierte mejor exige repartos de más de dos
  brazos; el reparto de hoy es binario. Es su propia feature.
- **Elegir voz o texto según la persona.** Rompe el principio de observar comportamiento y no
  personas, y contamina la medición: la voz se vuelve una variable no controlada dentro de un brazo.
- **Generar texto con un modelo de lenguaje**, en tiempo de ejecución o fuera de él para mostrarlo
  sin revisión.
- **Ampliar el vocabulario de candidatos.** Las familias de mensaje son las que el plano ya elige;
  esta feature las viste, no las inventa.

## Preguntas que decide el plan

1. **¿Dónde vive el corpus?** Está planeada una operación para que un merchant publique su catálogo
   de mensajes. Con textos escritos por OPE, eso queda sin sujeto: el corpus se parece más a un
   activo del release —donde la revisión por una persona es la revisión del cambio, que es
   exactamente lo que se exige— y a nivel merchant quedaría sólo la correspondencia de valores, que
   ya tiene por dónde entrar. La operación está **planeada y no construida**, así que cambiarla
   ahora no cuesta nada y después cuesta una versión mayor.
2. **Cómo se le muestra al merchant lo que le falta mapear**, reusando el mecanismo que ya existe
   para los anclajes que el SDK no resuelve.
3. **Prosa completa contra plantilla con huecos** (ver Assumptions).
