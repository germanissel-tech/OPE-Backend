# Feature Specification: Los textos se editan por API, en la capa base y en la de cada merchant

**Feature Branch**: `038-textos-por-api`

**Created**: 2026-10-04

**Status**: Draft

**Input**: Decisión del dueño, 2026-10-04, después de tensionar las alternativas: «lo que realmente
necesitamos es poder editar los textos, no agregar nuevas claves; ya sean los textos base de cada
lenguaje como los textos que cada merchant prefiere para cada clave». Las decisiones tomadas en esa
conversación están en «Lo decidido antes de la spec».

## Por qué existe

Los textos que ve una persona en la tienda —lo que OPE dice cuando interviene— son curados y
versionados (constitución VIII). Hoy viven en un archivo del release: se leen al arrancar, se juzgan
ahí, y se sirven de memoria. Cambiar una palabra de un texto, o agregar un idioma, es un deploy.

El panel de administración ya publica por API los tres niveles de configuración (ADR-031, feature 036)
y los textos son la única parte del tratamiento que sigue atada al release. Y mientras tanto quedó un
hueco: la completitud del corpus se verifica al arrancar contra el idioma de reserva **de los archivos
del release**, y desde la 036 ese idioma puede cambiar por API sin que nada lo verifique. Un operador
puede publicar como reserva un idioma sin textos y la consecuencia aparece después, en silencio: la
decisión no encuentra qué decir y termina en `NO_OP`.

Esta feature hace tres cosas: los textos base se editan por API, cada merchant puede tener su texto
propio por clave e idioma, y la comprobación cruzada entre idiomas y textos pasa a hacerse al publicar,
que es el único momento en que se puede rechazar.

## Lo decidido antes de la spec

Para que nadie vuelva a derivar lo que ya se discutió:

- **Dos capas.** La **base**, cerrada en familias y completa en cada idioma soportado; y la **del
  merchant**, dispersa, por idioma, que se resuelve antes que la base dentro del mismo idioma.
- **El idioma manda sobre la personalización.** El orden sigue siendo el de hoy: idioma de la página,
  después idioma de reserva; y dentro de cada idioma, primero el texto del merchant y después el base.
  Un merchant que personalizó su texto en español, con la página en inglés y la base en inglés, muestra
  la base en inglés.
- **La clave de un texto** es familia, valor de atributo, idioma y merchant (ausente en la base). El
  editor **nunca** crea familias ni valores de atributo: son vocabulario cerrado de OPE.
- **La voz se retira.** Hoy es un tipo cerrado con un solo valor y el contrato la describe como un estilo
  compartido; el servicio no cae de la voz elegida a la neutral aunque el contrato lo prometa. Con una
  capa por merchant, la voz no nombra nada: se retira del contrato y de los identificadores de versión.
- **Cada texto se publica solo**, con una versión inmutable por clave acuñada por OPE. Un cuerpo
  idéntico al vigente no crea versión. **Quitar** el texto de un merchant es una publicación más, con
  historial, y vuelve a la base; en la base está prohibido quitar.
- **Un texto es tratamiento.** Si una publicación alcanza un experimento activo, exige motivo y reinicia
  su ventana, con la regla de la feature 036. Se acepta el motivo por cada texto. Un texto base alcanza a
  todo merchant sin texto propio en esa clave e idioma.
- **Un idioma entra a la lista de soportados sólo cuando la base está completa en él**, en el nivel de
  defaults o en el del merchant. Los textos de un idioma todavía no soportado se pueden editar en la base
  y acumularse.
- **El archivo del release pasa a ser semilla** de la capa base: se importa sólo en un almacén vacío y
  es inerte después, como los niveles en la 036.
- **El camino de decisión no cambia**: los textos se sirven de memoria y ninguna decisión gana I/O.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Un operador edita un texto base y vale desde la petición siguiente (Priority: P1)

Un operador de OPE corrige desde el panel un texto base de un idioma —una palabra, una frase entera—
y la próxima intervención que use esa clave en ese idioma lo muestra, sin reiniciar nada, con una
versión nueva que queda en el historial de esa clave y en el registro de administración.

**Why this priority**: es lo que hoy cuesta un deploy, y es la mitad que no depende de ningún merchant.
Con esta historia sola, el panel ya sirve para corregir un texto en producción.

**Independent Test**: publicar una versión nueva de un texto base por la API, provocar una decisión que
lo use y comprobar que la intervención trae el texto nuevo y estampa la versión nueva; que el historial
de la clave lista las dos versiones; y que el registro de administración tiene la entrada.

**Acceptance Scenarios**:

1. **Given** un texto base vigente para una clave y un idioma, **When** un operador publica otro texto
   para esa clave, **Then** se crea la versión siguiente de la clave, la próxima intervención que la
   use muestra el texto nuevo y estampa su versión, y el registro de administración tiene la entrada
   con actor, instante, clave y versión resultante.
2. **Given** un texto vigente, **When** se publica un cuerpo idéntico, **Then** no se crea versión y
   la respuesta lo dice, como ya hace el nivel merchant.
3. **Given** un texto vacío, uno más largo de lo admitido o uno con un marcador sin resolver, **When**
   se publica, **Then** se rechaza nombrando el motivo y no se crea versión.
4. **Given** una familia o un valor de atributo que no existen en el vocabulario de OPE, **When** se
   publica un texto para esa clave, **Then** se rechaza: el editor no crea claves.
5. **Given** un texto base en un idioma que ningún nivel soporta todavía, **When** se publica, **Then**
   se acepta y queda en el historial: los textos de un idioma se pueden acumular antes de soportarlo.
6. **Given** la capa base, **When** un operador intenta quitar un texto, **Then** se rechaza: la base
   tiene que seguir completa.
7. **Given** que el almacén no puede escribir, **When** se publica, **Then** la operación falla y no
   queda ni la versión ni la entrada de auditoría, ni a medias.

---

### User Story 2 - Un merchant tiene su propio texto para una clave, y puede volver a la base (Priority: P1)

Un operador con alcance sobre un merchant publica desde el panel el texto que ese merchant prefiere
para una clave en un idioma. Desde la petición siguiente, las intervenciones de ese merchant en ese
idioma muestran su texto; las de los demás merchants siguen mostrando la base. Cuando el merchant ya no
quiere su texto, el operador lo quita, queda en el historial, y la clave vuelve a la base.

**Why this priority**: es la otra mitad de lo que el dueño pidió, y vale por sí sola: una tienda que
habla distinto de la base puede decirlo con sus palabras sin que OPE toque la base de todas.

**Independent Test**: publicar un texto de merchant para una clave e idioma, provocar una decisión de
ese merchant y otra de un merchant distinto, y comprobar que sólo la primera muestra el texto propio;
después quitarlo y comprobar que vuelve la base y que el historial conserva las tres versiones.

**Acceptance Scenarios**:

1. **Given** una clave con texto base en un idioma, **When** un operador publica un texto de merchant
   para esa clave e idioma, **Then** las intervenciones de ese merchant en ese idioma muestran el texto
   propio y estampan su versión, y las de cualquier otro merchant siguen mostrando la base.
2. **Given** un texto de merchant en español, **When** una página de ese merchant está en inglés y la
   base tiene inglés, **Then** la intervención muestra la base en inglés: el idioma manda sobre la
   personalización.
3. **Given** un texto de merchant vigente, **When** el operador lo quita, **Then** queda una versión
   más en el historial de la clave que dice que fue quitado, y la próxima intervención muestra la base.
4. **Given** un operador cuyo alcance no incluye al merchant, **When** publica un texto para ese
   merchant, **Then** se rechaza como en toda operación de administración fuera de alcance.
5. **Given** un merchant con texto propio para una clave, **When** se publica un texto base nuevo
   para esa misma clave e idioma, **Then** ese merchant no está alcanzado: su texto propio sigue
   ganando, y la base nueva alcanza a los demás.
6. **Given** un texto de merchant, **When** otro merchant pide una intervención con la misma clave,
   **Then** nunca recibe el texto del primero: nada cruza merchants.

---

### User Story 3 - Un cambio de texto con experimentos activos exige su motivo y reinicia la ventana (Priority: P1)

Un operador intenta publicar un texto mientras hay experimentos activos alcanzados. El sistema se
niega y dice por qué; si el operador insiste con el motivo, el texto entra, la ventana de medición de
cada experimento alcanzado se reinicia, y todo queda en el registro.

**Why this priority**: sin esto, el panel permite cambiar un tratamiento en medio de una medición sin
que nada lo diga, que es exactamente lo que la 036 vino a impedir para las políticas. Es la misma regla
con el mismo mecanismo; lo que esta historia agrega es qué significa «alcanzado» para un texto.

**Independent Test**: con un experimento activo de un merchant sin texto propio, publicar un texto
base sin motivo (rechazo) y después con motivo, comprobando que la ventana del experimento se reinició
y que la entrada lleva el motivo; repetir con un merchant que sí tiene texto propio y comprobar que no
está alcanzado.

**Acceptance Scenarios**:

1. **Given** un experimento activo de un merchant sin texto propio para la clave e idioma, **When** se
   publica un texto base sin motivo, **Then** se rechaza con el problema de configuración congelada y
   no se crea versión.
2. **Given** ese mismo caso, **When** se publica con motivo, **Then** se crea la versión, la ventana de
   cada experimento alcanzado se reinicia, y el registro guarda el motivo.
3. **Given** un experimento activo de un merchant **con** texto propio para esa clave e idioma,
   **When** se publica un texto base, **Then** ese experimento no está alcanzado y su ventana no se
   reinicia.
4. **Given** un experimento activo de un merchant, **When** se publica o se quita un texto **de ese
   merchant**, **Then** sólo ese experimento está alcanzado y aplica la misma regla.
5. **Given** diez publicaciones seguidas con motivo sobre el mismo merchant, **When** terminan,
   **Then** la ventana del experimento quedó reiniciada en la última y la medición no perdió nada más
   que con un reinicio.
6. **Given** un experimento en calibración, **When** se publica un texto, **Then** no bloquea ni se
   reinicia.

---

### User Story 4 - Un idioma no se puede soportar sin textos (Priority: P2)

Un operador publica una versión de defaults, o de la configuración de un merchant, que agrega un
idioma a los soportados o lo nombra como reserva. El sistema sólo la acepta si la capa base está
completa en ese idioma; si no, la rechaza diciendo qué familias faltan.

**Why this priority**: es el hueco que esta feature cierra. Va después de las tres primeras porque sin
textos editables por API no hay forma de completar un idioma sin un deploy, y la regla sería un
bloqueo sin salida.

**Independent Test**: con la base completa sólo en un idioma, publicar unos defaults que agregan otro
idioma (rechazo que nombra las familias), completar la base en ese idioma por la API y publicar de
nuevo (aceptado).

**Acceptance Scenarios**:

1. **Given** una base incompleta en un idioma, **When** una publicación de defaults o de merchant lo
   agrega a los soportados o lo nombra reserva, **Then** se rechaza nombrando las familias que faltan y
   no se crea versión.
2. **Given** la base completa en ese idioma, **When** se vuelve a publicar, **Then** se acepta.
3. **Given** un idioma ya soportado, **When** se publica una versión que lo quita, **Then** se acepta:
   quitar un idioma no necesita textos.
4. **Given** un arranque sobre un almacén con textos y niveles ya guardados, **When** el servidor
   arranca, **Then** no vuelve a juzgar la completitud contra los archivos del release: lo que vale es
   lo publicado, y la regla ya se aplicó al publicar.

---

### User Story 5 - El historial de cada clave se puede ver (Priority: P3)

Un operador abre en el panel el historial de una clave —base o de un merchant— y ve sus versiones:
cuándo, quién, con qué motivo cuando lo hubo, y el texto tal como se publicó, incluidas las versiones
que quitaron un texto.

**Why this priority**: sin esto se puede publicar pero no explicar. Es P3 porque el registro de
administración ya deja la traza de cada publicación.

**Independent Test**: publicar tres versiones de una clave, una de ellas quitándola, y comprobar que el
historial las lista más nueva primero con su actor, su motivo y su contenido.

**Acceptance Scenarios**:

1. **Given** varias versiones de una clave, **When** un operador pide su historial, **Then** las recibe
   de la más nueva a la más vieja, paginadas, con versión, instante, actor, motivo y contenido.
2. **Given** una versión concreta, **When** un operador la pide, **Then** recibe su texto tal como se
   publicó, inmutable, aunque ya no sea la vigente.
3. **Given** un operador sin alcance sobre un merchant, **When** pide el historial de una clave de ese
   merchant, **Then** se rechaza; el historial de la base lo puede leer cualquier operador.

---

### Edge Cases

- **La semilla.** `config/messages.json` pasa a ser la semilla de la capa base: se importa sólo si el
  almacén de textos está vacío, a nombre del operador del sistema, y un arranque que no lo aplica lo
  dice en el log. Editar el archivo después del primer arranque no hace nada. El archivo pierde el
  campo de voz, y sus identificadores de versión de texto dejan de llevarla.
- **La completitud al arrancar.** Hoy el arranque rechaza un corpus incompleto en el idioma de reserva
  del release. Con la semilla, esa comprobación se hace **al importar** la semilla, contra los idiomas
  que los niveles sembrados soportan, y nunca más al arrancar: después de la semilla, la regla vive en
  las publicaciones.
- **Un texto del merchant para una clave que la base no tiene en ese idioma.** Se acepta: la capa del
  merchant es dispersa y su texto gana en su idioma. Lo que no puede pasar es que ese idioma esté
  soportado sin base completa, y eso lo impide la historia 4.
- **Quitar lo que no existe.** Quitar un texto de merchant que ya está quitado no crea versión y la
  respuesta repite la versión vigente, igual que un cuerpo idéntico. En el cuerpo, quitar es `remove: true`
  en lugar del texto, nunca los dos: el validador del servidor habla el meta-esquema 3.0 y un `null` no es
  expresable en él. Quitar uno que nunca se publicó
  tampoco crea versión, y la respuesta dice que no hay ninguna: no hay versión vigente que repetir.
- **Diez publicaciones seguidas.** Cada una exige su motivo si hay experimentos alcanzados, y cada una
  reinicia la ventana. Reiniciar una ventana recién reiniciada no pierde nada más. La fricción del
  motivo repetido se acepta y se mide con el uso; un modo borrador queda fuera.
- **Una decisión entre dos publicaciones.** Entre la tercera y la séptima edición, una intervención se
  mostró con un tratamiento mezclado. No es un problema de evidencia: cada intervención estampa la
  versión exacta del texto que mostró. Es un problema de lectura del experimento, y la ventana
  reiniciada lo resuelve.
- **La voz en lo ya registrado.** Las intervenciones ya estampadas llevan identificadores de versión con
  la voz en el nombre. No se reescriben: el ledger es inmutable, y un identificador viejo sigue
  identificando el texto que se mostró.
- **Dos procesos.** Fuera de alcance como en todo el hito (D-21): una instancia. Con dos, cada una
  tendría su copia en memoria de los textos y una publicación no alcanzaría a la otra.
- **El tamaño del texto en memoria.** El corpus en memoria crece con los merchants que personalizan, no
  con el tráfico. Es del orden de la configuración, no del ledger.

## Requirements _(mandatory)_

### Functional Requirements

**Publicar**

- **FR-001**: Un operador MUST poder publicar un texto base para una clave —familia, valor de atributo
  cuando la familia lo lleva, e idioma— por la API de administración, y MUST poder publicar un texto de
  un merchant para esa misma clave e idioma con el merchant en la ruta.
- **FR-002**: Toda publicación MUST crear una versión **numerada por OPE, correlativa por clave e
  inmutable**; el operador declara el texto, nunca el número.
- **FR-003**: Un texto idéntico al vigente de la misma clave y capa MUST NOT crear versión, y la
  respuesta MUST decirlo.
- **FR-004**: Un texto vacío, más largo que el máximo admitido o con un marcador sin resolver MUST
  rechazarse nombrando el motivo, sin crear versión.
- **FR-005**: Una familia o un valor de atributo fuera del vocabulario de OPE MUST rechazarse: la
  publicación nunca crea claves.
- **FR-006**: Quitar el texto de un merchant MUST ser una publicación con su versión en el historial,
  tras la cual la clave resuelve a la base; quitar un texto base MUST rechazarse.
- **FR-007**: Una publicación MUST valer desde la petición siguiente sin reiniciar el servidor, y MUST
  NOT agregar I/O a ninguna decisión: los textos siguen sirviéndose desde memoria.
- **FR-008**: Toda publicación MUST quedar en el registro de administración con actor, instante,
  operación, clave, capa, versión resultante y motivo cuando lo hubo; y una publicación que no se
  pueda auditar MUST NOT ocurrir.
- **FR-009**: El alcance del operador MUST juzgarse como en toda operación de administración: la base
  exige alcance total; el texto de un merchant, alcance sobre ese merchant.

**Resolver**

- **FR-010**: La resolución de un texto MUST probar el idioma de la página y después el de reserva del
  merchant, y dentro de cada idioma primero el texto del merchant y después el base. El idioma manda
  sobre la personalización.
- **FR-011**: Un texto de un merchant MUST NOT servirse nunca a otro merchant.
- **FR-012**: Cada intervención MUST seguir estampando la versión del texto que mostró, con un
  identificador que ya no lleva voz; las intervenciones ya registradas MUST NOT reescribirse.

**Medición**

- **FR-013**: Con al menos un experimento **activo alcanzado**, una publicación sin motivo MUST
  rechazarse con el problema de configuración congelada.
- **FR-014**: Un experimento está **alcanzado** por un texto base cuando su merchant no tiene texto
  propio para esa clave e idioma; y por un texto de merchant, cuando es el experimento de ese merchant.
- **FR-015**: Una publicación con motivo MUST crear la versión, MUST reiniciar la ventana de medición de
  cada experimento alcanzado, y el motivo MUST quedar en el registro.
- **FR-016**: Un experimento en calibración MUST NOT bloquear ni reiniciar nada.

**Idiomas y completitud**

- **FR-017**: La capa base MUST estar completa —un texto por cada familia **que no depende del
  producto**— en cada idioma que algún nivel soporte o nombre como reserva. Una familia que habla de un
  atributo del producto es decible sólo cuando el valor del producto tiene texto, así que no tiene texto
  incondicional y no cuenta para la completitud; es la regla que el arranque aplica hoy (01 §322).
- **FR-018**: Una publicación de defaults o de configuración de merchant que agregue un idioma a los
  soportados o lo nombre reserva MUST rechazarse nombrando las familias que faltan cuando la base no
  está completa en ese idioma; quitar un idioma MUST aceptarse.
- **FR-019**: Un texto base en un idioma que ningún nivel soporta MUST aceptarse y acumularse.

**Semilla e historial**

- **FR-020**: El archivo de textos del release MUST pasar a ser **semilla** de la capa base: se importa
  sólo cuando el almacén de textos está vacío, a nombre del operador del sistema, juzgando su
  completitud contra los idiomas que los niveles sembrados soportan; un arranque que no la aplica MUST
  decirlo. El archivo MUST perder el campo de voz.
- **FR-021**: Los textos MUST sobrevivir un reinicio, y el arranque MUST servir la última versión de
  cada clave sin volver a juzgar la completitud contra el release.
- **FR-022**: Un operador MUST poder listar las versiones de una clave, más nueva primero y paginadas,
  y leer una versión concreta tal como se publicó, incluidas las que quitaron un texto; con el mismo
  alcance que la publicación.

**Contrato**

- **FR-023**: La voz MUST retirarse del contrato y de los identificadores de versión de texto. El
  contrato está en construcción, así que el cambio incompatible se acepta y se reporta.
- **FR-024**: Lo que el SDK recibe MUST seguir teniendo la misma forma: la intervención trae el texto
  y su versión, como hoy.

### Key Entities

- **Texto**: lo que OPE dice para una clave en un idioma, en una capa. Tiene reglas: no vacío, acotado,
  sin marcadores sin resolver. Sólo existe válido.
- **Clave de texto**: familia, valor de atributo cuando la familia lo lleva, e idioma. Familia y valor
  de atributo son vocabulario cerrado de OPE; la clave nunca se crea por la API.
- **Capa**: la base, de todos, cerrada en familias y completa por idioma soportado; o la de un merchant,
  dispersa, que gana sobre la base en su idioma.
- **Versión de un texto**: el contenido de una clave en una capa tal como quedó en un momento, con su
  número correlativo por clave, actor, instante y motivo cuando lo hubo. Inmutable. Una versión puede
  decir «quitado». Es lo que cada intervención estampa.
- **Experimento alcanzado**: el que mide un tratamiento que el texto publicado modifica: para un texto
  base, los de merchants sin texto propio en esa clave e idioma; para un texto de merchant, el de ese
  merchant.
- **Idioma soportado**: el que un nivel declara servir o nombra como reserva. Sólo puede serlo con la
  base completa en él.
- **Semilla**: el contenido inicial de la capa base, que viene del archivo del release y se aplica una
  sola vez, sobre un almacén vacío.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: **Todo texto base y todo texto de merchant se cambia desde la API**, y cada cambio se
  observa en la intervención siguiente del merchant alcanzado sin reiniciar el servidor, en el mismo
  proceso.
- **SC-002**: **Ningún texto llega a un merchant que no es el suyo**: verificable con dos merchants y un
  texto propio de uno de ellos, en la misma corrida y tras un reinicio.
- **SC-003**: **Un cambio con experimentos activos no pasa desapercibido**: sin motivo se rechaza; con
  motivo, cada experimento alcanzado tiene su ventana reiniciada y el motivo queda en el registro; y un
  merchant con texto propio no está alcanzado por un cambio de la base. Verificable contando alcanzados
  y no alcanzados en la misma corrida.
- **SC-004**: **Ningún idioma puede quedar soportado sin textos**: verificable intentando publicar
  idiomas con la base incompleta, completándola por la API y volviendo a publicar.
- **SC-005**: **Toda intervención es explicable desde el ledger**: para cualquier texto que una persona
  vio, el identificador de versión estampado lleva a su contenido, actor, instante y motivo, sin mirar
  el código ni los archivos del release.
- **SC-006**: **El camino de decisión no paga nada**: el p95 de la ingesta no empeora de forma
  apreciable contra la misma corrida sin la feature, en la misma máquina.
- **SC-007**: **Nada del comportamiento existente cambia** salvo de dónde salen los textos y la
  resolución por capas: ninguna prueba anterior cambia de expectativa salvo las que afirmaban la voz o
  el corpus del release como fuente.
- **SC-008**: **Un arranque sobre un almacén con textos no aplica la semilla y lo dice**, verificable
  arrancando dos veces y leyendo el log.

## Assumptions

- **La regla de experimentos alcanzados de la 036 se reutiliza con una definición nueva de
  «alcanzado»**: la de FR-014. El plan confirma que el servicio que hoy decide el alcance admite otra
  fuente de merchants alcanzados; si no, se construye al lado con la misma forma.
- **Las familias y los valores de atributo son los que el código declara.** La publicación los juzga
  contra ese vocabulario; cambiarlo sigue siendo un deploy, por diseño.
- **La completitud se juzga por familia incondicional**, la misma regla que el arranque aplica hoy. La
  primera versión de esta spec decía «y por cada valor de atributo»; el plan lo corrigió leyendo el
  código: una familia que habla de un atributo no exige texto, porque un producto cuyo valor no tiene
  prosa simplemente no dice nada de él.
- **El operador es responsable del cambio**, y el sistema no lo sustituye: le exige el motivo cuando
  hay medición en curso, lo registra, y reinicia lo que ese cambio invalidó.
- **Una instancia** (D-21): los textos viven en memoria y una publicación alcanza a este proceso.
- **La constitución X se enmienda en una frase**: donde dice que el merchant elige «la versión del
  catálogo de mensajes», pasa a decir que recibe el último texto publicado de cada clave y que lo que
  se estampa es la versión del texto. Es un parche de redacción, no un principio nuevo; el plan lo
  lleva al Constitution Check.
- **El contrato admite la superficie nueva**: está marcado en construcción, así que retirar la voz y
  cambiar los identificadores de versión se acepta y se reporta.

## Fuera de alcance, con su motivo

- **La lectura desde el portal del merchant.** El consumidor `portal` existe y todas sus operaciones
  están planificadas; su esquema de autenticación sigue propuesto desde ADR-020 y se decide con el hito
  del portal. Mientras tanto, lo que un merchant recibe se puede ver desde el panel de administración
  con un operador acotado a ese merchant.
- **Crear familias o valores de atributo.** Son vocabulario de OPE y un deploy, por diseño.
- **Un modo borrador o la publicación por lote.** Se acepta el motivo por cada texto y se mide la
  fricción con el uso.
- **Voces de estilo compartidas entre merchants.** La voz se retira; si un estilo compartido vuelve a
  hacer falta, es otra feature con su propio concepto.
- **Multi-instancia e invalidación entre procesos** (D-21).
- **Que el panel muestre el impacto de un cambio** antes de aplicarlo, más allá de rechazarlo sin
  motivo: es una feature de producto.
