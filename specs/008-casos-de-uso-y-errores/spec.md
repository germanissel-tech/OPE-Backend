# Feature Specification: Casos de uso uniformes, servicios de aplicación y errores estandarizados

**Feature Branch**: `008-casos-de-uso-y-errores`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "La capa de aplicación tiene que ser reconocible y uniforme:
cada caso de uso es una clase con sufijo `UseCase` que respeta un mismo contrato de ejecución,
separa lo que recibe en cada llamada (request/response) de lo que necesita para operar
(dependencias, declaradas como interfaces y entregadas como un objeto tipado y mínimo), y
nunca invoca a otro caso de uso: lo compartido vive en servicios de aplicación. Los errores de
negocio se devuelven, nunca se lanzan, con una raíz común y un error por módulo definido en su
dominio, de modo que quien consume un caso de uso sabe por tipo qué puede fallar y la
traducción a HTTP es una sola función, sin conversiones. Todo verificado por reglas con
fixture. Migrar los cinco casos de uso existentes sin cambiar comportamiento."

## Contexto

Las features 004–007 construyeron la capa de aplicación con fábricas de funciones
(`makeIngestBatch(deps) → función`) que reciben puertos por closure. Es inyección de
dependencias, pero sin contrato común: cada caso de uso inventa su firma, su forma de resultado
(`{ ok, invariant, detail }`, `{ ok, reason }`, `{ ok, unavailable }`) y su nombre; las
dependencias viajan en bloque (`{ ...ports }`) y un caso de uso invoca a otro
(`ingestBatch` → `assignVisitor`) desde un helper de composición. Los errores de negocio son
strings sueltos (`"session-visitor-mismatch"`) que el controller traduce a mano.

Nada de eso está roto — la suite lo prueba — pero tampoco es reconocible ni escala: al llegar
el plano de decisión (barrera, evidencia, quality gate, política) la aplicación va a crecer
de cinco casos de uso a más de veinte, y un revisor, un agente o el propio equipo tienen que
poder abrir cualquiera y saber en un segundo qué recibe, qué devuelve, de qué depende y qué
puede fallar. Esta feature fija esa forma una vez, la hace cumplir por herramienta (como la
005 hizo con la forma del código) y migra lo existente sin tocar comportamiento.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Todo caso de uso tiene la misma forma y se reconoce por su nombre (Priority: P1)

Quien lee la capa de aplicación encuentra, por módulo, una carpeta de casos de uso donde cada
archivo define una clase con sufijo `UseCase` que implementa el mismo contrato: un método de
ejecución que recibe un request tipado y devuelve un response tipado. Lo que el caso de uso
necesita para operar llega por el constructor como un objeto de dependencias tipado, mínimo y
nombrado, cuyos campos son interfaces (puertos o servicios), nunca implementaciones. Lo que
recibe en cada ejecución es el request. Las dos cosas no se mezclan.

**Why this priority**: es la definición de "reconocible". Sin contrato común no hay forma
uniforme de probar, decorar ni auditar un caso de uso.

**Independent Test**: los cinco casos de uso existentes son clases `*UseCase` que implementan
el contrato; una clase bajo la carpeta de casos de uso sin el sufijo, sin el contrato, o con
una dependencia que no es interfaz, falla la verificación de arquitectura; la suite anterior
pasa sin modificar aserciones.

**Acceptance Scenarios**:

1. **Given** el módulo `ingestion`, **When** se lista su carpeta de casos de uso, **Then** hay
   una clase `IngestBatchUseCase` con `execute(request)` que devuelve un response tipado.
2. **Given** un caso de uso, **When** se lee su constructor, **Then** recibe un único objeto
   cuyo tipo es una interfaz de dependencias nombrada (`*Dependencies`) con sólo interfaces
   de puertos o servicios; ninguna implementación concreta.
3. **Given** una clase en la carpeta de casos de uso sin sufijo `UseCase`, o que no implementa
   el contrato, **When** corre la verificación, **Then** falla nombrando el archivo.
4. **Given** una interfaz de dependencias con más campos que el límite declarado, **When**
   corre la verificación, **Then** falla: el caso de uso hace demasiado y hay que extraer un
   servicio.
5. **Given** los controllers HTTP, **When** se leen, **Then** reciben un caso de uso por su
   contrato y sólo traducen DTO ↔ request/response.
6. **Given** la suite de las features 001–007, **When** corre, **Then** pasa sin modificar
   aserciones.

---

### User Story 2 - Un caso de uso nunca invoca a otro; lo compartido es un servicio (Priority: P1)

Un caso de uso es el punto de entrada de una intención externa (un controller, un job). Lo que
dos casos de uso comparten y necesita puertos —hoy, resolver y registrar la asignación— es un
servicio de aplicación con interfaz propia, inyectado en quien lo necesite. El orden del
pipeline se lee en un solo lugar: el caso de uso que orquesta.

**Why this priority**: encadenar casos de uso esconde la orquestación y duplica fronteras
(transacción, log, medición); la constitución exige que el orquestador invoque a las
autoridades en orden y a la vista.

**Independent Test**: la carpeta de casos de uso de ningún módulo importa de una carpeta de
casos de uso (propia o ajena); la asignación es un servicio con interfaz que `IngestBatchUseCase`
recibe y que se prueba con un doble sin arrastrar sus puertos.

**Acceptance Scenarios**:

1. **Given** `IngestBatchUseCase`, **When** se leen sus dependencias, **Then** recibe un
   servicio de asignación por interfaz, no un caso de uso.
2. **Given** un caso de uso que importa otro caso de uso, **When** corre la verificación de
   arquitectura, **Then** falla nombrando ambos.
3. **Given** el servicio de asignación, **When** se lo prueba, **Then** conserva las
   propiedades de la 007 (idempotencia, estabilidad, drift, ledger no disponible) con sus
   pruebas nombradas.

---

### User Story 3 - Los errores de negocio se devuelven tipados, con raíz común y catálogo por módulo (Priority: P1)

Un caso de uso devuelve un resultado que es éxito con valor o fallo con error, y el error es
siempre una instancia de una raíz común con un código estable, el módulo que lo emite y datos
seguros. Cada módulo define sus propios errores en su dominio; quien consume el caso de uso
sabe por tipo cuál de ellos puede recibir y decide con un `switch` exhaustivo. Los errores de
negocio nunca se lanzan; lanzar queda para errores de programación.

**Why this priority**: sin raíz común el resultado genérico admite cualquier cosa, y la
gestión de errores termina en conversiones de tipo en cada frontera.

**Independent Test**: los errores existentes (invariantes del lote y de la exposición,
ledger no disponible) son clases del dominio de su módulo con código literal; `Result` sólo
admite errores de esa raíz; un `throw` de un error de negocio falla el lint; cada código
existe en el catálogo de tipos de problema con su status.

**Acceptance Scenarios**:

1. **Given** un lote con dos visitantes, **When** ejecuta `IngestBatchUseCase`, **Then** el
   response es un fallo cuyo error es `SessionVisitorMismatch` del dominio `ingestion`, con
   `code` `session-visitor-mismatch`.
2. **Given** el tipo de response de un caso de uso, **When** se lee, **Then** enumera la unión
   de errores posibles; un `switch` sobre `error.code` sin cubrir uno de ellos no compila.
3. **Given** un archivo de errores de un módulo, **When** corre la verificación, **Then**
   toda clase extiende la raíz común, declara `code` y `module` literales y `module` coincide
   con su módulo.
4. **Given** los códigos de todos los módulos, **When** corre la prueba de réplica, **Then**
   son únicos y cada uno existe en el catálogo de tipos de problema con su status.
5. **Given** un `throw` de un error de negocio en aplicación o dominio, **When** corre el lint,
   **Then** falla; un `catch` genérico en aplicación también.

---

### User Story 4 - La traducción a HTTP es una sola función (Priority: P2)

El adaptador HTTP convierte cualquier error de negocio en Problem Details con una única
función que usa el código del error como `type` y el catálogo como fuente del status y el
título; los controllers no construyen errores a mano. Las respuestas HTTP no cambian.

**Why this priority**: es el beneficio visible de la estandarización; sin él, cada controller
vuelve a decidir cómo mapear.

**Independent Test**: los controllers de las tres operaciones usan la función única; las
pruebas de integración de 004–007 pasan sin cambios; un error con código fuera del catálogo
no compila o falla la prueba de réplica.

**Acceptance Scenarios**:

1. **Given** cualquier `DomainError`, **When** pasa por la función de traducción, **Then** sale
   un Problem Details con `type` `urn:ope:problem:<code>`, el `status` y el `title` del
   catálogo, `detail` con el mensaje y `instance` con la ruta; nunca datos internos.
2. **Given** los tres controllers, **When** se leen, **Then** no contienen ningún literal de
   tipo de problema; sólo la función de traducción.
3. **Given** el error de ledger no disponible en la exposición, **When** se traduce, **Then**
   sigue siendo `503` con `Retry-After` (la función conoce los headers por código).

---

### User Story 5 - Decoradores transversales sobre el contrato común (Priority: P3)

Con todos los casos de uso bajo el mismo contrato, una preocupación transversal se aplica
envolviendo cualquier caso de uso sin tocarlo: el primero es el registro operativo (nombre del
caso de uso, duración, éxito o código de error, sin request ni datos personales). La
composición decide qué decoradores envuelven a qué casos de uso.

**Why this priority**: demuestra que el contrato común paga; abre la puerta a medición y
transacciones (persistencia) sin tocar la aplicación.

**Independent Test**: un decorador de registro envuelve `IngestBatchUseCase` en la composición;
el log operativo muestra nombre, duración y resultado por ejecución; el caso de uso no cambia.

**Acceptance Scenarios**:

1. **Given** un caso de uso envuelto por el decorador de registro, **When** se ejecuta,
   **Then** el log tiene una entrada con su nombre, la duración y `ok` o el `code` del error,
   y no contiene el request ni `visitorId`.
2. **Given** el caso de uso sin decorar, **When** se lo prueba, **Then** no sabe que existe el
   decorador (misma clase, mismas pruebas).

---

### Edge Cases

- Un caso de uso que no puede fallar por negocio: su response es el valor directo, sin
  `Result` (no se envuelve por uniformidad vacía); la regla lo admite.
- Un error de programación (contrato roto, invariante interna): `throw new Error`, nunca un
  `DomainError`; el adaptador HTTP lo convierte en `500 internal-error` como hoy.
- Un servicio de aplicación que necesita otro servicio: permitido; lo prohibido es
  caso de uso → caso de uso. Un servicio no importa casos de uso.
- Un error con `details` que incluye un identificador de visitante: prohibido por la
  lista de datos personales del contrato; la prueba del decorador de registro lo verifica.
- Un caso de uso cuya interfaz de dependencias supera el límite: no se relaja el límite; se
  extrae un servicio.
- Módulo sin errores propios (`system`): no necesita archivo de errores; la regla sólo exige
  forma cuando el archivo existe.

## Requirements _(mandatory)_

### Functional Requirements

**Contrato de caso de uso**

- **FR-001**: MUST existir un contrato común de caso de uso: una interfaz genérica con un único
  método de ejecución que recibe un request tipado y devuelve una promesa de response tipado.
- **FR-002**: Todo caso de uso MUST ser una clase con sufijo `UseCase`, en la carpeta de casos
  de uso de su módulo, que implementa el contrato; una por archivo.
- **FR-003**: Lo que un caso de uso necesita para operar MUST llegar por el constructor como un
  único objeto cuyo tipo es una interfaz de dependencias nombrada, con campos que son
  interfaces de puertos, de servicios de aplicación o utilidades transversales (reloj,
  identificadores, registro); MUST NOT recibir implementaciones concretas ni el contenedor de
  puertos.
- **FR-004**: El número de campos de una interfaz de dependencias MUST tener un límite
  declarado y verificado (por defecto seis); superarlo falla la verificación.
- **FR-005**: Los controllers HTTP MUST recibir los casos de uso por su contrato y limitarse a
  traducir DTO ↔ request/response.

**Servicios de aplicación**

- **FR-010**: Un caso de uso MUST NOT importar ni invocar a otro caso de uso; la verificación de
  arquitectura lo hace cumplir.
- **FR-011**: La lógica compartida entre casos de uso que necesita puertos MUST ser un servicio
  de aplicación con interfaz propia, en la carpeta de servicios de su módulo, inyectado como
  interfaz; la asignación de visitantes (007) MUST migrar a esa forma.
- **FR-012**: Un servicio de aplicación MUST NOT importar casos de uso.

**Errores**

- **FR-020**: MUST existir una raíz común de errores de negocio en el núcleo compartido del
  dominio: una clase abstracta que extiende `Error` con `code` (slug estable), `module`
  (módulo emisor) y `details` (datos seguros, sin datos personales).
- **FR-021**: Cada módulo MUST definir sus errores en un archivo de errores de su dominio, como
  clases que extienden la raíz con `code` y `module` literales; `module` MUST coincidir con el
  módulo; MUST exportar la unión de sus errores.
- **FR-022**: El tipo de resultado MUST cerrarse sobre la raíz (`Result<T, E extends
DomainError>`), con constructores de éxito y fallo; un caso de uso MUST declarar en su
  response la unión exacta de errores que puede devolver.
- **FR-023**: Los errores de negocio MUST devolverse, nunca lanzarse; un `throw` de una instancia
  de la raíz MUST fallar el lint en dominio y aplicación; un `catch` genérico en aplicación
  también.
- **FR-024**: Los códigos MUST ser únicos entre módulos y cada uno MUST existir en el catálogo de
  tipos de problema del contrato con su status, verificado por prueba de réplica.
- **FR-025**: Los errores existentes MUST migrar: invariantes del lote y de la exposición,
  ledger no disponible (que pasa a ser un error del módulo `ledger` devuelto por los puertos y
  los casos de uso).

**Traducción HTTP**

- **FR-030**: El adaptador HTTP MUST exponer una única función que convierte cualquier error de
  la raíz en Problem Details (`type` desde `code`, `status` y `title` desde el catálogo,
  `detail` desde el mensaje, `instance` desde la ruta, headers por código cuando aplique) y
  los controllers MUST usarla en lugar de construir errores.
- **FR-031**: Las respuestas HTTP de las operaciones construidas MUST NOT cambiar (mismos
  status, tipos y cuerpos; Schemathesis sin cambios).

**Decoradores**

- **FR-040**: MUST existir un decorador de registro operativo que envuelve cualquier caso de
  uso y registra nombre, duración y resultado (éxito o código) sin request ni datos personales;
  la composición MUST aplicarlo a los casos de uso servidos por HTTP.

**Verificación y documentación**

- **FR-050**: Toda regla nueva (arquitectura o lint) MUST tener fixture que la viola y prueba.
- **FR-051**: Una decisión de arquitectura MUST registrar el contrato, la separación caso de
  uso / servicio, la jerarquía de errores y la traducción; la guía de agentes MUST describir
  cómo se escribe un caso de uso nuevo y su error.
- **FR-052**: La migración MUST NOT cambiar comportamiento: la suite de 001–007 pasa sin
  modificar aserciones; los cambios en pruebas se limitan a cómo se construye el sujeto.

### Key Entities

- **Caso de uso**: clase `*UseCase` que implementa `UseCase<Request, Response>`; constructor
  con `*Dependencies` (interfaces, ≤ 6 campos); `execute(request)`.
- **Servicio de aplicación**: interfaz `*Service` + implementación; lógica compartida con
  puertos; nunca invoca casos de uso.
- **Raíz de error**: `DomainError` (`code`, `module`, `details`, `message`).
- **Error de módulo**: clase por error en `domain/<módulo>/errors.ts`; unión exportada.
- **Resultado**: `Result<T, E extends DomainError>` con `ok(value)` y `fail(error)`.
- **Traducción**: `toProblem(error, instance)` → Problem Details (+ headers por código).
- **Decorador**: `UseCase<I, O>` que envuelve otro `UseCase<I, O>`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: El 100 % de los casos de uso (los cinco actuales) son clases `*UseCase` con el
  contrato común, dependencias por interfaz y errores tipados; ninguno invoca a otro.
- **SC-002**: Cada regla nueva tiene al menos un fixture que la viola y falla en la primera
  corrida (sufijo/contrato, dependencias no interfaz, límite de dependencias, caso de uso →
  caso de uso, servicio → caso de uso, error sin raíz o `module` incorrecto, `throw` de error
  de negocio, `catch` genérico).
- **SC-003**: Los códigos de error de dominio son únicos y el 100 % existe en el catálogo con
  su status (prueba de réplica en verde).
- **SC-004**: Las pruebas de integración y Schemathesis de 004–007 pasan sin cambios en
  aserciones ni en el contrato.
- **SC-005**: Un caso de uso nuevo se escribe siguiendo la guía en un solo archivo de aplicación
  más su archivo de errores, sin tocar el adaptador HTTP para su traducción.
- **SC-006**: `quality`, `test:mutation` y `release-check` en verde.

## Assumptions

- Nombre del método de ejecución: `execute` (canónico de Clean Architecture).
- Dependencias como un objeto tipado (interfaz `*Dependencies`), no parámetros posicionales:
  legible en el cableado, compatible con el límite de parámetros de la 005.
- Límite de dependencias por caso de uso: seis; se declara en la regla y se puede ajustar por
  decisión escrita, no por excepción.
- `code` sin prefijo de módulo: la unicidad la garantiza la prueba de réplica contra el
  catálogo (que ya es único por construcción); el prefijo duplicaría información.
- Un caso de uso que no puede fallar por negocio devuelve el valor directo; `Result` es para
  fallos de negocio.
- Sin librerías de `Result` (neverthrow y similares): el tipo es de ocho líneas y no justifica
  una dependencia.
- La composición sigue siendo el único lugar con `new` (regla existente); los decoradores se
  aplican ahí.
- Sin cambios de contrato HTTP ni de mapa; sin cambios de comportamiento observable.
