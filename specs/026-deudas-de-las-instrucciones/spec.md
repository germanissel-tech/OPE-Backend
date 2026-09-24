# Feature Specification: Las cuatro deudas de las instrucciones se registran y se cierran

**Feature Branch**: `026-deudas-de-las-instrucciones`

**Created**: 2026-09-24

**Status**: Draft

**Input**: Decisión del dueño del 2026-09-24, después de preguntar qué quedaba pendiente:
«registrá las cuatro deudas y vamos a corregir toda esa deuda».

## El problema

La feature 019 creó un **registro de deudas técnicas** —una tabla con identificador, título, origen,
estado, fecha y cierre, y una historia por deuda— y dejó escrito que **una deuda que llega después
abre otra feature con el mismo formato**.

Las features 024 y 025 nombraron **cuatro deudas y no registraron ninguna**. Tres viven como el
motivo de una sección declarada mixta en la política de instrucciones; la cuarta, como un párrafo de
la investigación de la 025. Están escritas, pero no donde el repositorio las busca.

**Esta feature es, antes que nada, la que hace que el registro vuelva a ser verdad.** Lo segundo es
cerrar las cuatro.

### Corrección de una afirmación previa

Al listar lo pendiente reporté que el mapa del contrato tenía un hito del roadmap mal escrito. **Era
falso**: mi recuento leyó la palabra dentro de un comentario. Los cinco hitos están bien formados y
su verificación pasa. **Esta feature no toca el mapa**, y lo dice acá porque la autorización del
dueño se dio sobre esa información equivocada.

### Las cuatro deudas, medidas

| Deuda    | Dónde vive                       | Tamaño | Qué mezcla                                                                  |
| -------- | -------------------------------- | -----: | --------------------------------------------------------------------------- |
| **D-07** | `Convenciones`, en el núcleo     |     44 | reglas de escritura que un agente obedece **con** descripciones del sistema |
| **D-08** | `Gates de calidad`, en su regla  |     58 | cómo se trabaja el gate de mutación **con** los umbrales del linter         |
| **D-09** | `Anillos y módulos`, en su regla |     90 | la tabla de anillos **con** la lista de módulos que existen hoy             |
| **D-10** | dentro de `Gates de calidad`     |     16 | un **procedimiento de cuatro pasos** escrito como si fuera una instrucción  |

Las cuatro son **la misma operación** aplicada a cuatro lugares: separar lo que dice **qué hacer** de
lo que describe **cómo es el sistema**. El criterio ya está escrito (feature 025) y el gate que lo
verifica ya existe (feature 024).

D-07 tiene un efecto extra: es la sección más grande que queda en el núcleo, y el núcleo está en
**195 de 200 líneas**. Separarla es lo que le devuelve margen.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - El registro de deudas vuelve a ser verdad (Priority: P1)

Quien pregunta qué deuda técnica queda abierta **la encuentra en el registro**, no repartida entre
el motivo de una configuración y el párrafo de una investigación.

**Why this priority**: es la que hace que el resto se pueda rastrear. Sin ella, cerrar las cuatro
deudas dejaría el registro igual de falso que ahora, sólo que con menos deuda adentro. Y es la que
el propio repositorio ya pedía por escrito desde la 019.

**Independent Test**: se prueba sola buscando las cuatro deudas en el registro y comprobando que
cada una tiene origen, fecha y —al cerrarse— su referencia de cierre.

**Acceptance Scenarios**:

1. **Given** el registro, **When** alguien busca la deuda que dejó la partición de las
   instrucciones, **Then** la encuentra como una fila con su identificador, no en un archivo de
   configuración.
2. **Given** una deuda cerrada por esta feature, **When** se lee su fila, **Then** dice dónde quedó
   cerrada.
3. **Given** una deuda nueva que aparezca **mientras** se hace esta feature, **When** se la anota,
   **Then** entra al registro con su fila en vez de arrastrarse en otro lado.

---

### User Story 2 - La sección de convenciones dice una sola cosa (Priority: P1)

Un agente que lee las convenciones recibe **reglas que obedece**. Lo que describe cómo es el sistema
vive donde se decidió, y acá queda el puntero.

**Why this priority**: es la más grande de las tres y la única que está en el núcleo, así que es la
que devuelve margen al archivo que tiene que entrar en una pasada. Va con la primera.

**Independent Test**: se prueba sola contando el núcleo después de separarla y comprobando que deja
de estar declarada mixta.

**Acceptance Scenarios**:

1. **Given** la sección separada, **When** se lee lo que queda en el núcleo, **Then** todo lo que
   hay son reglas que un agente obedece.
2. **Given** lo descriptivo que se fue, **When** se lo busca, **Then** está completo en su destino y
   el núcleo dice dónde.
3. **Given** el núcleo, **When** se cuentan sus líneas, **Then** bajó respecto de 195 y sigue bajo
   el umbral.

---

### User Story 3 - Las dos reglas acotadas dicen una sola cosa (Priority: P2)

Lo mismo, en las dos reglas que quedaron mixtas: los umbrales describen la configuración del linter,
que es su propia fuente; la lista de módulos describe lo que existe hoy, y su gate ya lo verifica.

**Why this priority**: el beneficio es real pero menor que el de la primera, porque estas dos ya no
cargan en toda sesión. Se pueden entregar después y de a una.

**Independent Test**: por regla, comprobar que deja de estar declarada mixta y que lo descriptivo
está completo en su destino.

**Acceptance Scenarios**:

1. **Given** una de las dos reglas separada, **When** se la lee, **Then** lo que queda es lo que un
   agente obedece cuando trabaja sobre esa parte del código.
2. **Given** lo descriptivo que se fue, **When** se lo busca, **Then** está en la fuente que ya lo
   gobierna, y no duplicado.

---

### User Story 4 - El procedimiento del gate de mutación se ejecuta, no se lee (Priority: P3)

Ante un mutante que sobrevive, quien lo enfrenta **sigue un procedimiento de cuatro pasos** en vez
de leer un párrafo largo y decidir de memoria.

**Why this priority**: es la de menor urgencia y la de mayor riesgo de equivocarse en el destino, así
que va última, cuando las tres separaciones ya mostraron cómo se comporta el reparto.

**Independent Test**: se prueba sola comprobando que el procedimiento está donde se lo invoca, que
la regla conserva el puntero y que, si terminó siendo una skill, no depende de este repositorio por
ruta.

**Acceptance Scenarios**:

1. **Given** el procedimiento en su destino, **When** alguien enfrenta un mutante superviviente,
   **Then** tiene los cuatro pasos en orden y sabe cuál sigue.
2. **Given** la regla, **When** se la lee, **Then** dice que el procedimiento existe y dónde está.
3. **Given** que el destino elegido fuera una skill, **When** se la revisa, **Then** no importa nada
   de este repositorio por ruta, como exige el aislamiento ya probado.

---

### Edge Cases

- **Una separación que no se puede hacer.** Si al abrir una sección mixta resulta que sus dos partes
  no se pueden separar sin perder sentido, **la sección se queda mixta** y su deuda queda registrada
  con el motivo. Cerrar una deuda por decreto es peor que dejarla anotada.
- **Lo descriptivo que no tiene destino.** Si un párrafo describe algo que ningún documento gobierna
  todavía, el destino hay que crearlo o el párrafo se queda; inventar un documento sólo para poder
  mudar es el trámite que este trabajo debería estar eliminando.
- **Una deuda nueva encontrada al separar.** Se registra como fila propia. No se arrastra dentro de
  esta feature: mezclarla haría ilegible qué cerró qué.
- **El procedimiento que no es un procedimiento.** Si al mirarlo de cerca resulta que nadie lo
  ejecuta paso a paso sino que lo consulta, **no es material de skill** y el destino es otro. La
  pregunta se responde antes de mover, no después.
- **La feature se aplica a sí misma**: el registro y las instrucciones que separa gobiernan cómo se
  hace toda feature, incluida ésta.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: El repositorio MUST tener las cuatro deudas registradas con identificador, título,
  origen, estado y fecha, en el lugar donde el repositorio busca su deuda técnica.
- **FR-002**: Una deuda cerrada MUST decir dónde quedó cerrada.
- **FR-003**: El registro MUST poder recibir una deuda nueva sin reabrir la feature que la originó.
- **FR-004**: Ninguna sección de las instrucciones MUST quedar declarada mixta sin una deuda
  registrada que diga por qué.
- **FR-005**: Lo que se separe de una sección mixta MUST estar completo en su destino **antes** de
  borrarse del origen.
- **FR-006**: Lo descriptivo que se mueva MUST ir a la fuente que ya lo gobierna, y no duplicarse.
- **FR-007**: El núcleo de las instrucciones MUST bajar de sus 195 líneas y seguir bajo su umbral.
- **FR-008**: Un procedimiento de varios pasos MUST vivir donde se lo ejecuta, y su instrucción MUST
  conservar que existe y dónde está.
- **FR-009**: Una sección que no se pueda separar sin perder sentido MUST quedarse como está, con su
  deuda registrada y el motivo escrito.
- **FR-010**: Las verificaciones que hoy cubren las instrucciones MUST seguir en verde sobre los
  siete archivos al terminar.

### Key Entities

- **Registro de deudas**: la lista de lo que se sabe que falta, con el estado de cada cosa. Su valor
  es ser **completa**: una deuda que existe y no está ahí vale menos que no tenerla anotada, porque
  da la impresión de que no hay.
- **Deuda**: algo que se sabe que falta, con su origen, su estado y —al cerrarse— dónde se cerró.
- **Sección mixta**: una sección de las instrucciones que mezcla lo que se obedece con lo que se
  consulta. Es una deuda declarada, no una categoría de reposo.
- **Procedimiento**: una secuencia de pasos que alguien ejecuta en orden. Se distingue de una
  instrucción en que no se consulta: se sigue.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Las cuatro deudas están en el registro, cada una con origen y fecha, y las cerradas
  con su referencia de cierre.
- **SC-002**: **Cero secciones declaradas mixtas** al terminar; si alguna queda, tiene su deuda
  registrada y su motivo, y eso se enumera.
- **SC-003**: El núcleo de las instrucciones **baja de 195 líneas** y sigue bajo su umbral.
- **SC-004**: Por cada separación, lo que se movió está completo en su destino, verificado sección
  por sección y no por conteo total.
- **SC-005**: Nada de lo descriptivo queda duplicado entre su destino y las instrucciones.
- **SC-006**: Las verificaciones de las instrucciones quedan en verde sobre los siete archivos.
- **SC-007**: El procedimiento del gate de mutación está en un solo lugar, y la instrucción que lo
  nombraba conserva el puntero.
- **SC-008**: La cadena completa queda verde y ninguna prueba del producto cambia: esta feature no
  toca el código.

## Assumptions

- **El registro sigue donde está, salvo que el plan encuentre que ése es el problema.** La feature
  019 lo dejó dentro de su propia especificación, y agregarle deudas de features posteriores hace
  crecer para siempre el documento de una feature cerrada. El plan decide si eso se sostiene o si el
  registro necesita un hogar propio; la spec no lo fuerza porque las dos opciones son defendibles y
  la evidencia se junta al planificar.
- **Las tres separaciones se pueden hacer.** Se asume porque las tres tienen su motivo escrito, que
  ya identifica las dos partes. Si alguna no se puede, FR-009 la deja quedarse.
- **El destino del procedimiento es una skill**, porque la documentación de la herramienta dice que
  un procedimiento de varios pasos lo es y el repositorio ya tiene dos. El plan lo confirma
  preguntando si alguien lo ejecuta o lo consulta.
- **Nada de esto toca el producto.** Las cuatro deudas son de documentación e instrucciones, así que
  las pruebas del producto no deberían moverse; si alguna se mueve, hay algo mal entendido.

## Out of Scope

- **El mapa del contrato.** No hay hito mal escrito; el reporte que lo afirmaba era mío y está
  corregido arriba.
- **El código, el contrato y las pruebas del producto.** Ninguna de las cuatro deudas los toca.
- **La única deuda que quedaba abierta del registro anterior** —un scaffold con la cadena de calidad
  de este repositorio para otros proyectos—. Es trabajo de otro tamaño y merece su propia
  conversación.
- **Las decisiones de producto todavía abiertas** (hosting, merchant piloto, régimen de datos,
  tamaño de muestra). Son decisiones pendientes, no deuda técnica, y su ADR ya fija que ninguna
  feature puede asumirlas.
- **Convertir en procedimiento cualquier otra sección.** Sólo la que la documentación señala. Si al
  separar aparece otra, se registra como deuda nueva.

## Constraints

- Commits en español, uno por historia; sin push hasta que el dueño lo pida; sin merge sin el dueño.
- La rama sale de `main`, que ya tiene las features 022 a 025.
- **La feature se aplica a sí misma**: si al terminar queda una deuda sin registrar, no está hecha.
- La decisión se registra como enmienda de ADR-032 sólo si el reparto entre destinos cambia de
  forma; si sólo se aplica el criterio ya escrito, no hace falta ADR nuevo. Lo decide el plan.
