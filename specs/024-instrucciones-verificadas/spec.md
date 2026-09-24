# Feature Specification: Las instrucciones tienen criterio de admisión y gate

**Feature Branch**: `024-instrucciones-verificadas`

**Created**: 2026-09-24

**Status**: Draft

**Input**: Decisión del dueño del 2026-09-24: «veo que `CLAUDE.md` está creciendo enormemente, y
encima veo mucho acople en su contenido, como por ejemplo comienza a tener conocimiento de los use
cases, hay que auditarlo». La auditoría se hizo; esta spec es lo que encontró.

## El problema, medido

`CLAUDE.md` es lo que un agente lee antes de tocar el repositorio. Hoy tiene **675 líneas y 7 801
palabras**, y entra entero en cada sesión.

**Crece y nunca baja.** De 360 a 675 líneas en **seis días** (+88 %), en una serie monótona. La causa
no es que alguien escriba de más: es que **el documento no tiene criterio de admisión**. Nada dice
qué entra y qué no, así que cada feature agrega su párrafo y ninguna saca nada.

**Casi nada lo verifica.** Dos cosas: sus citas `ADR-NNN` y sus marcadores de trabajo abierto. Los
**759 identificadores** que cita entre comillas de código —173 rutas de archivo, 92 clases o tipos,
**8 casos de uso**, **17 servicios y puertos**— no los mira ningún gate.

**Y sin embargo está exacto.** Verificado a mano: **366 de los 368 identificadores comprobables
resuelven** (los dos que no son una palabra de JSON Schema). El documento **no está podrido**. Está
exacto por la disciplina de quien lo edita, no por construcción. **Esta feature no arregla un
documento roto: deja de depender de la disciplina.**

**La deriva que sí ocurrió, con fecha.** Una línea dice que la ventana de firma vive en el módulo
`merchant`. Salió de ahí en la feature 017 (2026-09-21) y vive en el módulo `access` desde la
feature 020 (2026-09-22). **Tres días y dos features con el hogar viejo escrito**, y nada lo vio: la
verificación de identificadores saltea todo lo que parece una ruta, así que las rutas nunca se
miran.

**El acople que el dueño señaló, con su número.** Una sola sección ocupa **220 líneas, un tercio del
documento**. Adentro hay **diez bloques temáticos** que suman 195 líneas, y **los diez citan un
ADR**. Los ADR que duplican suman 636 líneas. El costo se ve en las ediciones: de **53 commits** que
tocaron `CLAUDE.md`, **32 tocaron además un ADR** (60 %) y 24 tocaron el código (45 %). Cada feature
escribe la misma decisión en dos lugares y **ningún gate compara los dos**.

**El repositorio ya resolvió esto una vez.** ADR-032 le dio a cada README de directorio una política
escrita y una prueba que la verifica, y esa prueba falla no sólo con un README equivocado sino con
**un directorio nuevo sin política**: obliga a decidir, no sólo a no equivocarse. Es el mismo
problema y el mismo remedio.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Una instrucción que dejó de ser cierta falla el build (Priority: P1)

Quien trabaja en el repositorio mueve un archivo, renombra una clase o agrega un comando. Si las
instrucciones de los agentes quedaron nombrando lo viejo, **se entera en el momento**, no tres días
y dos features después.

**Why this priority**: es el agujero que ya se abrió y se cerró solo por suerte. Un agente que lee
una instrucción falsa la ejecuta: busca un archivo donde no está, o peor, lo crea ahí. Sin esta
historia las otras dos son cosmética.

**Independent Test**: se prueba sola corriendo el gate contra el documento **como está hoy**: tiene
que encontrar la referencia vieja y el comando que falta, sin inventar ninguno.

**Acceptance Scenarios**:

1. **Given** el documento tal como está hoy, **When** se corre el gate, **Then** reporta la
   referencia a la ventana de firma en su módulo viejo, y el comando del repositorio que la tabla
   no menciona.
2. **Given** el documento con esas dos cosas corregidas, **When** se corre el gate, **Then** pasa.
3. **Given** que alguien mueve un archivo que el documento nombra, **When** corre la cadena de
   calidad, **Then** falla nombrando la línea.
4. **Given** que alguien agrega un comando al repositorio y no lo documenta, **When** corre la
   cadena, **Then** falla; y al revés también: un comando documentado que no existe falla.
5. **Given** las veintiuna cosas que el documento escribe con barras pero **no** son rutas —nombres
   de forma que se repiten en cada módulo, identificadores de reglas, una referencia de git,
   una clave compuesta—, **When** se corre el gate, **Then** no reporta ninguna.

---

### User Story 2 - El documento dice qué entra y qué no (Priority: P2)

Quien va a agregar algo a las instrucciones tiene **un criterio escrito** para decidir si va ahí o
en otro lado, y una prueba que se lo recuerda cuando abre una sección nueva.

**Why this priority**: es lo único que puede frenar el crecimiento monótono. El gate de la historia
1 evita que lo escrito se vuelva falso, pero no evita que el documento siga engordando con cosas que
tienen otro hogar.

**Independent Test**: se prueba sola agregando una sección sin declarar su política y verificando
que la prueba falla; y recorriendo las secciones de hoy, comprobando que ninguna quedó sin clasificar
y que las mixtas llevan su motivo.

**Acceptance Scenarios**:

1. **Given** el criterio escrito, **When** se recorre cada sección del documento, **Then** ninguna
   queda sin clasificar, y la que tenga párrafos de las dos clases lo declara **con su motivo**: la
   clase mixta nombra una deuda concreta, no es una forma de no decidir.
2. **Given** una sección nueva sin política declarada, **When** corre la prueba, **Then** falla
   pidiendo que se declare, igual que falla hoy un directorio nuevo sin política.
3. **Given** el criterio, **When** alguien pregunta si una decisión transversal nueva va en las
   instrucciones, **Then** la respuesta sale del criterio y no de una opinión.

---

### User Story 3 - Lo descriptivo vive en su hogar y acá queda el puntero (Priority: P3)

Un agente que necesita una decisión la encuentra **en un paso**: las instrucciones le dicen que
existe y dónde está; el contenido vive donde se decidió.

**Why this priority**: es el beneficio, no el mecanismo. Las dos historias anteriores dejan el
documento verificado y con criterio; ésta lo aplica a lo que ya está adentro. Se puede entregar
después, y de a un bloque.

**Independent Test**: por cada bloque mudado, comprobar que lo que se movió está en su destino antes
de borrarse del origen, y que desde las instrucciones se llega a él sin buscar.

**Acceptance Scenarios**:

1. **Given** un bloque que duplica un ADR, **When** se muda, **Then** el ADR contiene todo lo que el
   bloque decía y las instrucciones conservan de qué se trata y dónde está.
2. **Given** la mudanza terminada, **When** se cuentan las líneas, **Then** el documento **bajó por
   primera vez**, y la cifra queda registrada.
3. **Given** un agente que necesita una decisión mudada, **When** la busca desde las instrucciones,
   **Then** llega en un paso.

---

### Edge Cases

- **Una ruta abreviada.** El documento escribe cuarenta y siete rutas sin su raíz porque repetirla
  cuarenta y siete veces sería ruido, y usa **seis raíces implícitas distintas sin declarar
  ninguna**. Declararlas es más honesto que prohibirlas; lo que no puede seguir pasando es que sean
  implícitas.
- **Lo que parece una ruta y no lo es.** Nombres de forma que se repiten en cada módulo,
  identificadores de reglas, referencias de git, claves compuestas. Un gate ingenuo reportaría
  setenta y cinco falsos positivos: se comprobó. Distinguirlos es requisito, no adorno.
- **Una cita deliberada de algo que ya no existe.** Un ADR puede nombrar lo que se retiró, y las
  instrucciones también. El mecanismo de excepción con motivo que el repositorio ya usa alcanza.
- **Un comando que existe y no se documenta a propósito.** Si lo hay, se declara como excepción con
  su motivo; el silencio no cuenta como decisión.
- **La regla se aplica a sí misma.** El documento que se audita gobierna cómo se hace toda feature,
  incluida ésta: cualquier regla nueva tiene que cumplirse en el documento que la enuncia.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: El sistema MUST verificar que todo identificador que las instrucciones citan como
  código exista en el contrato, en sus catálogos, en el código o en las herramientas.
- **FR-002**: El sistema MUST verificar que toda **ruta** que las instrucciones citan resuelva a un
  archivo o directorio existente.
- **FR-003**: Las raíces implícitas con las que se abrevia una ruta MUST estar declaradas, y una
  ruta que no resuelva con ninguna de ellas MUST fallar.
- **FR-004**: El sistema MUST distinguir de una ruta lo que se escribe con barras y no lo es
  (nombres de forma, identificadores de reglas, referencias de control de versiones, claves
  compuestas), y MUST NOT reportarlos.
- **FR-005**: El sistema MUST verificar en **los dos sentidos** que la tabla de comandos y los
  comandos del repositorio coinciden: uno documentado que no existe falla, y uno que existe sin
  documentar también.
- **FR-006**: Toda excepción a FR-001…FR-005 MUST declararse con su motivo; una excepción sin motivo
  MUST fallar.
- **FR-007**: El repositorio MUST llevar escrito el criterio que decide qué entra en las
  instrucciones y qué tiene otro hogar, en términos de si el contenido **dice qué hacer** o
  **describe cómo es el sistema hoy**. Una sección que tenga párrafos de las dos clases MUST poder
  declararse así, **y esa declaración MUST exigir un motivo escrito**.
  _Amplía la versión original, que suponía la clasificación binaria. Al aplicar el criterio a las
  catorce secciones aparecieron tres con párrafos de los dos tipos (research R-05). Admitir la
  clase mixta con motivo obligatorio nombra una deuda concreta y localizada; forzar esas tres a un
  lado sería mentirle a la política el día uno, y dejarlas sin clasificar sería el «depende» que el
  criterio existe para eliminar._
- **FR-008**: El sistema MUST fallar cuando el documento gane una sección cuya política no esté
  declarada, de modo que abrirla obligue a decidir de qué lado cae.
- **FR-009**: El sistema MUST correr estas verificaciones dentro de la cadena que ya corre antes de
  publicar, sin que nadie tenga que acordarse de invocarlas.
- **FR-010**: El contenido que se mude a otro documento MUST estar completo en su destino **antes**
  de borrarse del origen, y las instrucciones MUST conservar de qué se trata y dónde encontrarlo.
- **FR-011**: El sistema MUST NOT pretender verificar que la prosa sea correcta: sólo que lo que
  nombra exista. Lo que el texto afirma lo verifica la revisión.

### Key Entities

- **Instrucciones de los agentes**: el documento que un agente lee antes de tocar el repositorio.
  Mezcla hoy dos cosas: lo **normativo** (qué debe hacer) y lo **descriptivo** (cómo es el sistema).
- **Criterio de admisión**: la regla que decide de cuál de las clases se trata un contenido, y por
  lo tanto si vive en las instrucciones o en otro documento. Una sección mixta declara una deuda
  concreta, con su motivo; no es una forma de no decidir.
- **Referencia**: cada cosa que las instrucciones nombran entre comillas de código. Tiene tres
  formas —identificador, ruta y comando— y cada una se verifica contra una fuente distinta.
- **Excepción declarada**: una referencia que a propósito no resuelve, con el motivo escrito.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Corrido contra el documento **como está hoy**, el gate reporta exactamente dos cosas:
  la referencia a la ventana de firma en su módulo viejo y el comando ausente de la tabla. Ningún
  falso positivo entre las veintiuna cosas que parecen rutas y no lo son.
- **SC-002**: Corregidas esas dos, el gate pasa, y queda dentro de la cadena que corre antes de
  publicar sin invocación manual.
- **SC-003**: Mover un archivo que el documento nombra, o agregar un comando sin documentarlo, hace
  fallar la cadena nombrando dónde. Verificado con un caso de prueba de cada uno.
- **SC-004**: El criterio de admisión está escrito y **cada una de las catorce secciones** del
  documento está clasificada, sin ninguna sin clasificar. Las que tengan párrafos de las dos clases
  llevan su motivo escrito: **cero secciones mixtas sin motivo**.
- **SC-005**: Una sección nueva sin política declarada hace fallar la prueba, verificado con su
  propio caso.
- **SC-006**: El documento **baja de líneas por primera vez desde que existe**, y la cifra queda
  registrada junto a la serie que venía subiendo.
- **SC-007**: Ningún ADR pierde información: por cada bloque mudado, lo que decía está en el destino.
- **SC-008**: Un agente encuentra en un paso cualquier decisión mudada, partiendo de las
  instrucciones.
- **SC-009**: La cadena completa queda verde y el documento cumple las reglas que él mismo enuncia.

## Assumptions

- **Las verificaciones se agregan a lo que ya existe, no se inventa un mecanismo nuevo.** El
  repositorio ya verifica identificadores en otros documentos y ya tiene el patrón de «política
  escrita más prueba que la verifica» funcionando para los README de directorio. Reusar los dos es
  más barato y más consistente que un tercer mecanismo; el plan confirma que encajan.
- **Las raíces implícitas se declaran, no se eliminan.** Escribir la raíz completa en las cuarenta y
  siete rutas abreviadas haría el documento más largo y menos legible, que es lo contrario de lo que
  esta feature busca.
- **La mudanza se juzga por si el puntero alcanza, no por cuántas líneas ahorra.** Un agente que no
  puede encontrar una decisión en un paso es peor que un documento largo. Si un bloque no se puede
  reemplazar por un puntero sin perder eso, se queda y se dice por qué.
- **El documento seguirá siendo largo, y está bien.** El objetivo no es un número de líneas: es que
  cada línea esté ahí por una razón declarada y que ninguna pueda volverse falsa en silencio.
- **Nadie externo depende del documento.** Es interno al repositorio, así que reorganizarlo no rompe
  nada fuera.

## Out of Scope

- **Reescribir los ADR.** La mudanza **agrega** a un ADR lo que le falte; no lo reordena ni lo
  reinterpreta. Un ADR es un registro fechado de una decisión, y reescribirlo es otra conversación.
- **Tocar la constitución.** Es la primera fuente de verdad y no está en discusión acá.
- **Cambiar el flujo de trabajo.** Es normativo, no tiene otro hogar y se queda donde está.
- **Las instrucciones de las skills.** Ya tienen su propio aislamiento verificado por prueba.
- **Verificar que la prosa diga la verdad.** Sólo se verifica lo mecánico: que lo nombrado exista.
  Prometer más sería prometer lo que ninguna herramienta puede sostener, y la diferencia queda
  escrita para que nadie la confunda.
- **Reducir el documento a un número de líneas objetivo.** Un objetivo numérico premiaría borrar
  cosas útiles; el criterio decide qué se va, no una meta.

## Constraints

- Commits en español, uno por historia; sin push hasta que el dueño lo pida; sin merge sin el dueño.
- La rama sale de `023-reparto-sin-ajuste-silencioso`, que sale de `022-tasas-de-punta-a-punta`;
  ninguna de las dos está en `main` al abrir esta feature.
- **La feature se aplica a sí misma**: el documento que se audita gobierna cómo se hace toda
  feature, incluida ésta.
- La decisión se registra como enmienda de ADR-032 (que inventó el patrón de política más prueba) o
  como ADR nuevo; lo decide el plan.
