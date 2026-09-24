# Feature Specification: El núcleo se lee siempre; el resto carga cuando hace falta

**Feature Branch**: `025-instrucciones-por-ruta`

**Created**: 2026-09-24

**Status**: Draft

**Input**: Decisión del dueño del 2026-09-24: «lo sigo viendo a `CLAUDE.md` con muchas líneas», y
la instrucción de buscar las recomendaciones oficiales antes de decidir cómo organizarlo.

## El problema, medido contra la fuente

La feature 024 le puso gate y criterio de admisión a las instrucciones de los agentes, y las bajó de
675 a 573 líneas mudando lo descriptivo a su ADR. Siguen siendo demasiado largas, y ahora hay un
número oficial contra el cual medirlas.

**La documentación oficial de Claude Code fija el umbral**: menos de **200 líneas** por archivo, y
da el motivo que importa más que el costo de contexto — un archivo más largo **se obedece peor**.
Nuestro núcleo tiene 573.

**El criterio oficial es más filoso que el que la 024 escribió**: no alcanza con que algo sea
normativo. Tiene que ser un hecho que el agente necesite **en toda sesión**. Lo que sólo importa
para una parte del código va a una regla acotada a esa parte, o a una skill.

**Y el arreglo obvio no sirve.** Medido contra la documentación: partir el archivo en importaciones,
o en archivos de regla sin acotar, **no cambia nada** — todo eso se expande y entra al contexto al
arrancar igual. Lo único que saca carga del arranque es acotar una regla a los archivos a los que se
aplica: entonces entra cuando el agente trabaja sobre ellos, y no antes.

**Cómo caen las catorce secciones de hoy**:

| Se queda en el núcleo (toda sesión) | líneas | Se acota a una parte del código | líneas |
| ----------------------------------- | -----: | ------------------------------- | -----: |
| Flujo de trabajo                    |     52 | Notas operativas del contrato   |     92 |
| Convenciones                        |     44 | Anillos y módulos               |     85 |
| Documentación viva                  |     31 | Cómo se escribe un caso de uso  |     59 |
| Tipado                              |     17 | Gates de calidad                |     51 |
| Reglas que fallan el build          |     12 | Cómo se escribe una entidad     |     48 |
| Comandos (del lazo normal)          |    ~10 | Auditoría de arquitectura       |     12 |
| Fuentes de verdad                   |      8 |                                 |        |
| Si existe `HANDOFF.md`              |      3 |                                 |        |
| Punteros de las seis que se van     |    ~18 |                                 |        |
| **≈ 195**                           |        | **347 fuera del arranque**      |        |

_Este reparto lo corrigió el plan, con dos cambios y su medición. **La cuenta original no cerraba**:
sumaba las secciones que se quedan pero no los punteros, y daba 211 — once por encima del umbral. De
ahí salieron los dos: la **tabla de comandos se va**, fusionada con el inventario de `scripts/`, que
ya describe 26 de sus 30 comandos y que una prueba ya verifica fila por fila; y el **tipado se
queda**, porque ya es casi todo invariante y su acotación sería casi universal — el peor negocio de
las siete._

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Lo que se lee siempre entra en una pasada (Priority: P1)

Un agente que abre una sesión recibe **sólo** lo que necesita en toda sesión, y lo recibe en un
documento que puede leer y obedecer entero. Lo que sólo importa para una parte del código le llega
cuando trabaja sobre esa parte.

**Why this priority**: es la feature. El umbral existe porque un documento más largo se obedece
peor, así que esto no es ahorro de contexto sino adherencia.

**Independent Test**: se prueba sola contando las líneas del núcleo y comprobando que cada sección
que se fue está acotada a la parte del código donde se aplica.

**Acceptance Scenarios**:

1. **Given** las instrucciones partidas, **When** se cuenta el núcleo, **Then** está por debajo de
   las doscientas líneas.
2. **Given** una sección que se fue, **When** se busca su contenido, **Then** está completo en su
   archivo nuevo: la suma de las partes conserva lo que había, salvo lo que se consolide a
   propósito, que se enumera.
3. **Given** un agente que va a escribir un caso de uso **nuevo**, sin haber leído ninguno,
   **When** consulta el núcleo, **Then** encuentra la invariante que le impide equivocarse, aunque
   el detalle esté en la regla acotada.
4. **Given** una parte del código sobre la que el agente no trabaja, **When** arranca la sesión,
   **Then** las instrucciones de esa parte no entran.

---

### User Story 2 - El gate sigue mirando lo que se mudó (Priority: P1)

Lo que la feature 024 garantizó para un archivo vale para los ocho: una referencia vieja falla el
build, viva donde viva.

**Why this priority**: **es igual de crítica que la primera y va con ella**. Partir el documento sin
extender el gate desharía lo que la 024 acaba de construir: siete archivos nuevos sin verificación
es volver al estado del que venimos, con más lugares donde esconderse.

**Independent Test**: se prueba sola rompiendo a propósito una referencia en cada archivo nuevo y
verificando que el build falla nombrando el archivo y la línea.

**Acceptance Scenarios**:

1. **Given** una ruta rota en cualquiera de los archivos nuevos, **When** corre la cadena, **Then**
   falla nombrando cuál y dónde.
2. **Given** un archivo de regla sin acotar y sin motivo escrito, **When** corre la cadena,
   **Then** falla: acotar es la decisión que hace falta tomar, y no tomarla no puede pasar
   inadvertido.
3. **Given** una regla acotada a una parte del código que no existe, **When** corre la cadena,
   **Then** falla: una regla que no se puede activar nunca es una regla muerta.
4. **Given** una sección sin clasificar en cualquiera de los ocho archivos, **When** corre la
   cadena, **Then** falla, como falla hoy en uno.
5. **Given** las verificaciones de citas de decisiones, marcadores e identificadores, **When**
   corren, **Then** alcanzan a los ocho archivos y no sólo al núcleo.

---

### User Story 3 - Quien agrega una instrucción sabe dónde ponerla (Priority: P2)

Un agente que mañana quiere agregar una instrucción decide **sin preguntar** entre los tres
destinos: el núcleo, una regla acotada o una skill.

**Why this priority**: sin esto, la próxima instrucción vuelve al núcleo por inercia y el archivo
crece otra vez. Va tercera porque necesita que la partición ya exista para poder dar ejemplos
ciertos.

**Independent Test**: se prueba sola recorriendo los tres destinos y comprobando que cada uno tiene
su criterio y al menos un ejemplo real del repositorio.

**Acceptance Scenarios**:

1. **Given** el criterio escrito, **When** alguien tiene una instrucción nueva, **Then** el destino
   sale de la pregunta «¿hace falta en toda sesión?» y no de una opinión.
2. **Given** el criterio, **When** se lo aplica a las catorce secciones de hoy, **Then** da el mismo
   reparto que esta feature hizo.

---

### Edge Cases

- **Una regla que llega tarde.** Una regla acotada entra cuando el agente lee un archivo de esa
  parte. Escribir el **primer** archivo de una parte es justo cuando más se la necesita y puede que
  todavía no haya leído ninguno. Por eso el núcleo conserva de cada regla su invariante en una
  línea; y si una sección no se puede reducir a eso sin que el agente quede expuesto a
  equivocarse, **esa sección no se mueve**, y se dice por qué.
- **Una regla que se aplica a casi todo.** Acotar algo a todos los archivos de código lo hace entrar
  en casi toda sesión de código — pero no en las que sólo tocan documentación o el contrato, y
  nunca antes de que haga falta. Sigue siendo una mejora, aunque menor.
- **Una parte del código que todavía no existe.** Una regla acotada a algo que no está es una regla
  que nunca se activa; se trata como un error, no como una previsión.
- **Dos reglas que se contradicen.** La fuente advierte que ante dos reglas contradictorias el
  agente puede elegir cualquiera. Partir el documento multiplica los lugares donde eso puede pasar,
  así que la revisión periódica que la fuente pide queda escrita junto al criterio.
- **La feature se aplica a sí misma.** El documento que se parte gobierna cómo se hace toda feature,
  incluida ésta.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: El núcleo de las instrucciones MUST quedar por debajo de doscientas líneas.
- **FR-002**: Toda sección que sólo importe para una parte del código MUST vivir acotada a esa
  parte, de modo que no entre al contexto cuando el agente no trabaja sobre ella.
- **FR-003**: El núcleo MUST conservar, de cada sección acotada, la invariante que impide
  equivocarse y de qué se trata; el detalle, los ejemplos y los nombres viven en la regla.
- **FR-004**: Una sección que no pueda reducirse a esa invariante sin exponer al agente a
  equivocarse MUST quedarse en el núcleo, con el motivo escrito.
- **FR-005**: El contenido MUST moverse tal cual; lo que se consolide MUST enumerarse.
- **FR-006**: Toda regla MUST declarar a qué parte del código se aplica, o declarar por qué no lo
  hace; ninguna de las dos cosas puede faltar.
- **FR-007**: El sistema MUST fallar cuando una regla se acote a una parte del código que no existe.
- **FR-008**: Las verificaciones que hoy cubren el núcleo —que lo citado exista, que cada sección
  esté clasificada, que las citas de decisiones y los marcadores sean válidos— MUST cubrir también
  cada archivo de regla.
- **FR-009**: El repositorio MUST llevar escrito cómo se elige entre los tres destinos de una
  instrucción nueva, con la pregunta que los separa y un ejemplo real de cada uno.
- **FR-010**: El criterio de admisión que la feature anterior escribió MUST incorporar la pregunta
  que le falta: además de si dice qué hacer, si hace falta **en toda sesión**.

### Key Entities

- **Núcleo de las instrucciones**: lo que un agente recibe al abrir cualquier sesión. Su límite es
  doscientas líneas y su criterio es «hace falta siempre».
- **Regla acotada**: un archivo de instrucciones que declara a qué parte del código se aplica y
  entra al contexto sólo cuando el agente trabaja sobre ella.
- **Invariante de una línea**: lo que queda en el núcleo de una sección que se fue; es lo que
  impide equivocarse antes de que la regla llegue.
- **Destino de una instrucción**: uno de tres —núcleo, regla acotada o skill— y la pregunta que los
  separa es si hace falta en toda sesión y si es un procedimiento de varios pasos.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: El núcleo queda **por debajo de doscientas líneas**, y la cifra se registra contra la
  serie histórica (360 → 675 → 573 → …).
- **SC-002**: La suma del núcleo y las reglas **no pierde contenido**: lo consolidado a propósito se
  enumera, línea por línea, y no supera lo que esa enumeración declara.
- **SC-003**: Cada regla declara a qué parte del código se aplica, y **esa parte existe**: cada
  patrón alcanza al menos un archivo del repositorio, verificado.
- **SC-004**: Romper una referencia en **cualquiera** de los archivos hace fallar la cadena
  nombrando el archivo y la línea, verificado con un caso por archivo.
- **SC-005**: Una regla sin acotar y sin motivo falla; una regla acotada a algo inexistente falla.
  Las dos con su propio caso de prueba.
- **SC-006**: Las verificaciones de citas, marcadores e identificadores alcanzan a los ocho
  archivos, verificado por su recuento.
- **SC-007**: Aplicado el criterio a las catorce secciones de hoy, el reparto que da es el que esta
  feature hizo: siete y siete, sin secciones sin destino.
- **SC-008**: La cadena completa queda verde y el núcleo cumple las reglas que él mismo enuncia.

## Assumptions

- **La partición se hace con reglas acotadas, no con importaciones ni con archivos por
  subdirectorio.** Las importaciones no sacan nada del arranque —la fuente lo dice—; los archivos
  por subdirectorio sí, pero dispersan las instrucciones por el árbol de código y las mezclan con
  los inventarios que ya se gobiernan aparte. La regla acotada da la misma carga perezosa con un
  solo lugar donde buscar.
- **El reparto de las catorce secciones es el medido**, y el plan lo confirma sección por sección en
  vez de darlo por bueno. Si alguna no sobrevive la prueba de la invariante de una línea, se queda.
- **La herramienta admite reglas acotadas en la versión instalada.** Verificado antes de abrir la
  feature; el plan lo vuelve a confirmar, porque es la condición que la hace posible.
- **El umbral es el objetivo, no un piso a superar.** Bajar de doscientas es el éxito; perseguir un
  número menor premiaría borrar cosas útiles.
- **Nadie externo depende de estos archivos.** Son internos al repositorio.

## Out of Scope

- **Archivos de instrucciones por subdirectorio del código.** Dan carga perezosa, pero dispersan las
  instrucciones y las mezclan con los inventarios de directorio que ya tienen su propia política.
- **Convertir secciones en skills.** Es el tercer destino y probablemente el correcto para alguna
  —la forma de trabajar el gate de mutación es un procedimiento de varios pasos—, pero mezclar dos
  mudanzas en una feature hace ilegible qué mejoró qué. Se decide después, con el núcleo ya partido.
- **Reescribir el contenido de las secciones.** Se mueven tal cual. Reescribir y mover a la vez
  esconde lo que se perdió.
- **Las instrucciones de las skills**, que ya tienen su aislamiento verificado.
- **Perseguir un número por debajo del umbral.** El umbral es el objetivo.

## Constraints

- Commits en español, uno por historia; sin push hasta que el dueño lo pida; sin merge sin el dueño.
- La rama sale de `024-instrucciones-verificadas`, que sale de `023-reparto-sin-ajuste-silencioso` y
  `022-tasas-de-punta-a-punta`; ninguna de las tres está en `main` al abrir esta feature.
- **La feature se aplica a sí misma**: el núcleo tiene que cumplir las reglas que enuncia.
- La decisión se registra como enmienda de ADR-032 o como ADR nuevo —lo decide el plan— y **tiene
  que citar la documentación oficial como fuente del umbral**, para que el número no se lea como una
  preferencia.
