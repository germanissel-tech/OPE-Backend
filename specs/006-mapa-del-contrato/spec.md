# Feature Specification: Mapa del contrato y convenciones transversales

**Feature Branch**: `006-mapa-del-contrato`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "API-first de verdad: toda la superficie HTTP del MVP declarada
antes de construirla. Un mapa del contrato gobernado (toda operación planeada con consumidor,
tag, esquema de seguridad, feature que la construye y estado), verificado como el resto de la
gobernanza: el contrato no puede declarar nada fuera del mapa ni el mapa citar tags o esquemas
inexistentes. Convenciones transversales decididas de una vez y registradas como decisión:
esquemas de autenticación por consumidor (SDK, plataforma del merchant, portal, admin),
idempotencia de notificaciones servidor a servidor, paginación y filtrado de lecturas,
versionado. Sin código de servidor: contrato y gobernanza."

## Contexto

Las features 001–005 fijaron _contract-first por feature_: el contrato de cada operación se
diseña y valida antes del código que la sirve. Pero el contrato sólo declara lo construido
(`getHealth`, `ingestEvents`, `confirmExposure`) y el único rastro de la superficie completa
es el catálogo cerrado de tags del ruleset. Los documentos del MVP implican bastante más:
configuración y autodiagnóstico del SDK (01-arquitectura-mvp.md §3.1.1, 02-integracion-
ecommerce.md §3), notificación de órdenes y devoluciones desde la plataforma del merchant
(02 §5, mecanismo A, DECIDIDO), catálogo y stock (02 §4, §6.2), lecturas del portal (01 §5.3,
§5.7) y administración de merchants, experimentos, banderas y kill switch (01 §14).

Lo que más cuesta corregir tarde no son las operaciones sino las **convenciones** que todas
heredan: cómo se autentica cada consumidor (hoy sólo existe la credencial pública del SDK),
cómo se reintenta sin duplicar una notificación de orden, cómo se pagina una lectura del
portal, cuándo cambia la versión mayor. Si cada feature las decide al llegar, el contrato
queda inconsistente aunque cada una pase `contract:check`. Esta feature las decide una vez,
las deja verificables y publica el mapa completo de lo que el backend va a exponer, con lo
construido y lo pendiente distinguidos de forma mecánica.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Toda operación que el backend va a exponer está en un mapa, antes de construirse (Priority: P1)

Un integrador, un revisor o un agente pueden ver en un solo lugar toda la superficie HTTP del
MVP: cada operación con su consumidor, su tag, su esquema de seguridad, la capacidad que exige,
la feature que la construye, su estado (planeada o construida) y la sección de los documentos
del MVP que la justifica. El mapa se mantiene solo: si el contrato declara una operación que
el mapa no conoce, o el mapa marca como construida una que el contrato no tiene, el chequeo
falla.

**Why this priority**: es la definición de API-first. Sin mapa, "contract-first" es sólo
"escribo el contrato un rato antes que el código".

**Independent Test**: el mapa lista las operaciones construidas con estado construida y las
planeadas con estado planeada; un chequeo compara mapa y contrato y falla ante cualquier
diferencia en cualquiera de los dos sentidos; una operación agregada al contrato sin entrada en
el mapa rompe `contract:check`.

**Acceptance Scenarios**:

1. **Given** el mapa y el contrato actuales, **When** corre el chequeo, **Then** pasa e
   informa cuántas operaciones están construidas y cuántas planeadas.
2. **Given** una operación nueva en el contrato sin entrada en el mapa, **When** corre el
   chequeo, **Then** falla nombrando el `operationId`.
3. **Given** una entrada del mapa marcada como construida cuyo `operationId` no existe en el
   contrato, **When** corre el chequeo, **Then** falla nombrándola.
4. **Given** una entrada del mapa con un tag, un esquema de seguridad o una capacidad que el
   contrato o las convenciones no definen, **When** corre el chequeo, **Then** falla.
5. **Given** una operación construida, **When** se compara su tag, seguridad y capacidad con
   los del mapa, **Then** coinciden (el mapa no es decorativo: describe lo que hay).
6. **Given** la documentación publicada del contrato, **When** se la abre, **Then** las
   operaciones planeadas son visibles como tales, separadas de las construidas.

---

### User Story 2 - Cada consumidor tiene su forma de autenticarse, decidida una vez (Priority: P1)

El backend tiene cuatro consumidores con confianza distinta: el SDK en el navegador del
visitante (credencial pública), la plataforma del merchant hablando servidor a servidor
(secreto compartido, nunca en un navegador), los usuarios del portal del merchant (identidad
de persona, sesión) y la operación de OPE (admin). El contrato declara un esquema de seguridad
por consumidor, las reglas de lint exigen que cada operación use el que corresponde a su tag,
y las capacidades requeridas siguen un vocabulario cerrado por consumidor.

**Why this priority**: la primera operación de plataforma (`notifyOrder`) y la primera del
portal van a necesitar esto; decidirlo al llegar cada una produce tres mecanismos ad hoc.

**Independent Test**: el contrato declara los cuatro esquemas; una operación con tag `outcomes`
que use la credencial del SDK falla el lint; una capacidad fuera del vocabulario de su
consumidor falla el lint; el catálogo de capacidades es un archivo gobernado.

**Acceptance Scenarios**:

1. **Given** el contrato, **When** se lo lee, **Then** existen esquemas de seguridad para SDK,
   plataforma, portal y admin, cada uno con su descripción, dónde viaja la credencial y qué
   garantiza.
2. **Given** una operación con tag `ingest` protegida con el esquema de plataforma, **When**
   corre el lint, **Then** falla: el tag fija el consumidor y el consumidor fija el esquema.
3. **Given** una operación con capacidad `orders:write` bajo el tag `portal`, **When** corre el
   lint, **Then** falla: esa capacidad pertenece al consumidor plataforma.
4. **Given** una operación pública (sólo `system`), **When** corre el lint, **Then** sigue
   exigiéndose `security: []` y ninguna capacidad, como hoy.
5. **Given** los esquemas del portal y de admin, **When** se leen, **Then** están marcados
   como propuestos hasta que exista la feature que los implemente, sin bloquear el
   `release-check`.

---

### User Story 3 - Una notificación servidor a servidor se puede reintentar sin duplicar nada (Priority: P2)

La plataforma del merchant notificará órdenes confirmadas y devoluciones; la red falla y la
plataforma reintenta. La convención fija cómo se identifica cada notificación (la identidad
autoritativa de la plataforma: `orderId`), qué responde el backend la primera vez y las
siguientes, y que ninguna notificación repetida produce un segundo hecho en el ledger. Es una
convención declarada y verificable en el contrato, no una promesa en prosa.

**Why this priority**: 01 §9 garantiza idempotencia de orden con `orderId`; 02 §5.2 fija
que toda orden entra al ledger. Si la primera operación de outcomes nace sin la convención,
el reintento produce órdenes duplicadas y contamina la medición.

**Independent Test**: la convención está escrita como decisión y como regla del ruleset:
toda operación de notificación declara la respuesta de "ya recibida" y su identidad de
idempotencia; una operación de outcomes sin eso falla el lint.

**Acceptance Scenarios**:

1. **Given** una operación planeada con tag `outcomes`, **When** se la diseña, **Then** el
   mapa exige que declare su clave de idempotencia y las dos respuestas (recibida por primera
   vez, ya recibida).
2. **Given** una operación de `outcomes` sin declaración de idempotencia, **When** corre el
   lint, **Then** falla.
3. **Given** la decisión escrita, **When** se la lee, **Then** dice qué hace el backend ante
   una notificación con el mismo `orderId` y contenido distinto (rechazo explícito, nunca
   sobrescritura silenciosa).

---

### User Story 4 - Las lecturas del portal se pagina y filtran de la misma manera (Priority: P2)

Toda operación de lectura de colecciones (decisiones, exposiciones, órdenes, asignaciones,
resultados) usa la misma forma de paginación, el mismo límite máximo, el mismo orden por
defecto y los mismos filtros básicos (ventana de tiempo). Es una convención con esquema
reutilizable en el contrato y una regla que la exige.

**Why this priority**: el portal llega tarde (016) pero las lecturas de auditoría del ledger
pueden llegar antes; una convención decidida ahora evita dos estilos de paginación.

**Independent Test**: existe un esquema reutilizable de página y de parámetros de paginación;
una operación de lectura de colección que no los use falla el lint.

**Acceptance Scenarios**:

1. **Given** una operación `GET` planeada con tag `portal` que devuelve una colección,
   **When** se la diseña, **Then** usa los parámetros y el envoltorio de página comunes.
2. **Given** una lectura de colección con paginación propia, **When** corre el lint, **Then**
   falla.
3. **Given** la decisión escrita, **When** se la lee, **Then** fija el límite máximo por página,
   el orden por defecto y cómo se expresa la ventana de tiempo.

---

### User Story 5 - El versionado y el ciclo de vida de una operación están definidos (Priority: P3)

Cuándo sube la versión mayor ya está decidido (ADR-003: cambio incompatible). Falta el resto
del ciclo de vida: cómo se marca una operación planeada en el contrato sin que el servidor la
sirva a medias, cómo se deprecia una construida, y cómo se retira. Queda escrito y el mapa lo
refleja con estados.

**Why this priority**: cierra el ciclo API-first; sin esto, "planeada" y "construida" son los
únicos estados y el retiro de una operación sería un cambio sin protocolo.

**Independent Test**: los estados del mapa son un conjunto cerrado; una operación marcada
como depreciada en el mapa lleva la marca de depreciación en el contrato, y viceversa; la
decisión escrita cubre los cuatro estados.

**Acceptance Scenarios**:

1. **Given** el mapa, **When** se lee una entrada, **Then** su estado es uno de: planeada,
   construida, depreciada, retirada.
2. **Given** una operación depreciada en el contrato, **When** corre el chequeo, **Then**
   exige que el mapa la tenga como depreciada, y al revés.
3. **Given** una operación retirada, **When** se la busca en el contrato, **Then** no existe
   y el mapa conserva su entrada con el estado retirada y la versión en que se retiró.

---

### Edge Cases

- Operación construida sin entrada en el mapa (alguien saltó el paso): `contract:check` falla;
  el mapa es la única forma de agregar superficie.
- Entrada planeada con `operationId` que después se construye con otro nombre: el chequeo
  falla por ambos lados hasta que se corrige el mapa (renombrar en el mapa es un cambio
  revisable).
- Dos operaciones planeadas con el mismo `operationId`: el mapa lo rechaza.
- Un tag nuevo (fuera del catálogo cerrado): ampliarlo es un cambio de alcance; el mapa y el
  ruleset deben cambiar juntos, y el chequeo lo verifica.
- Esquema de seguridad declarado en el contrato pero sin operación que lo use: permitido
  mientras esté marcado como propuesto (Redocly no lo cuenta como componente sin uso porque
  el mapa lo referencia); sin marca, falla.
- Operación planeada cuya justificación cita una sección de los documentos del MVP que no
  existe: falla como en el glosario, con aviso si los documentos no están disponibles.
- Mapa y contrato coinciden pero el mapa no cita ninguna feature para una planeada: falla; toda
  operación planeada pertenece a una feature del roadmap.

## Requirements _(mandatory)_

### Functional Requirements

**Mapa**

- **FR-001**: MUST existir un mapa del contrato, en un archivo gobernado del directorio del
  contrato, con una entrada por operación: `operationId`, método y ruta, consumidor, tag,
  esquema de seguridad (o público), capacidades requeridas, feature que la construye, estado
  y fuente en los documentos del MVP o la constitución.
- **FR-002**: El mapa MUST cubrir toda la superficie que los documentos del MVP implican para
  el backend: SDK (configuración y mapa de anclajes, autodiagnóstico de anclajes, confirmación
  de orden desde el navegador), plataforma (notificación de orden, notificación de devolución,
  catálogo y stock), portal (resultado experimental, estado de acumulación, lecturas del
  ledger por merchant), admin (merchants y rotación de credenciales, experimentos, banderas y
  kill switch, catálogo de mensajes) y sistema (salud), además de lo construido.
- **FR-003**: Un chequeo MUST fallar si el contrato declara una operación ausente del mapa, si
  el mapa marca como construida una ausente del contrato, si tag, seguridad o capacidades de
  una construida difieren entre ambos, si una entrada cita un tag, esquema, capacidad o feature
  inexistentes, si hay `operationId` repetidos, o si el estado no es del conjunto cerrado.
- **FR-004**: El chequeo MUST correr dentro de `contract:check` y en CI, e informar el conteo
  por estado.
- **FR-005**: La documentación publicada del contrato MUST mostrar las operaciones planeadas
  como tales, sin confundirlas con las construidas y sin que el servidor las sirva.

**Autenticación por consumidor**

- **FR-010**: El contrato MUST declarar un esquema de seguridad por consumidor: SDK
  (credencial pública, existente), plataforma del merchant (secreto compartido servidor a
  servidor, nunca en navegador, rotable), portal (identidad de persona con sesión) y admin
  (operación de OPE). Los que no tengan feature que los implemente MUST llevar marca de
  propuesto sin bloquear `release-check`.
- **FR-011**: Una decisión escrita MUST fijar, por consumidor: dónde viaja la credencial, qué
  identifica (merchant, persona, operador), qué garantiza, cómo se rota y qué respuesta
  produce su ausencia o invalidez.
- **FR-012**: Una regla del ruleset MUST exigir que el esquema de seguridad de una operación
  sea el que corresponde a su tag (tag ⇒ consumidor ⇒ esquema), y que `system` sea público.
- **FR-013**: Las capacidades requeridas MUST provenir de un catálogo cerrado por consumidor
  (archivo gobernado); una capacidad fuera del catálogo o de otro consumidor MUST fallar el
  lint.

**Idempotencia de notificaciones**

- **FR-020**: Una decisión escrita MUST fijar la convención de idempotencia de las
  notificaciones servidor a servidor: identidad de la notificación (la autoritativa de la
  plataforma, `orderId` para órdenes), respuesta a la primera recepción y a las repetidas, y
  rechazo explícito ante misma identidad con contenido distinto.
- **FR-021**: Una regla del ruleset MUST exigir que toda operación con tag `outcomes` declare
  su clave de idempotencia y las dos respuestas, mediante una extensión del contrato con forma
  fija.

**Lecturas de colecciones**

- **FR-030**: El contrato MUST definir esquemas reutilizables para paginar (parámetros y
  envoltorio de página) y para la ventana de tiempo, con límite máximo por página y orden por
  defecto fijados por decisión escrita.
- **FR-031**: Una regla del ruleset MUST exigir que toda operación de lectura que devuelva una
  colección use esos esquemas.

**Ciclo de vida y versionado**

- **FR-040**: Los estados del mapa MUST ser un conjunto cerrado: planeada, construida,
  depreciada, retirada; la decisión escrita MUST definir qué implica cada transición para el
  contrato, el servidor y la versión.
- **FR-041**: Una operación depreciada MUST llevar la marca de depreciación en el contrato y
  el estado en el mapa, verificados juntos; una retirada MUST conservar su entrada en el mapa
  con la versión de retiro.

**Verificación y documentación**

- **FR-050**: Toda regla nueva del ruleset MUST tener su fixture que la viola y su caso de
  prueba, como el resto de las reglas.
- **FR-051**: Todo sustantivo nuevo que el mapa introduzca (los de las operaciones planeadas)
  MUST tener su nota en el glosario con fuente antes de que su operación se construya; el mapa
  MUST poder citar sustantivos aún sin nota mientras la operación esté planeada.
- **FR-052**: La guía de agentes MUST incorporar el mapa al flujo: antes de cambiar el
  contrato, la operación tiene que existir en el mapa como planeada; construirla es pasarla a
  construida.
- **FR-053**: Esta feature MUST NOT agregar código de servidor ni cambiar el comportamiento de
  las operaciones construidas; el contrato de las tres existentes MUST seguir siendo
  compatible.

### Key Entities

- **Entrada del mapa**: `operationId`, método, ruta, consumidor, tag, esquema de seguridad,
  capacidades, feature, estado, fuente, y para retiradas la versión de retiro.
- **Consumidor**: SDK | plataforma | portal | admin | público. Determina esquema de seguridad
  y vocabulario de capacidades.
- **Esquema de seguridad**: uno por consumidor autenticado; los no implementados, propuestos.
- **Catálogo de capacidades**: por consumidor, cerrado, gobernado.
- **Convención de idempotencia**: clave, respuestas, regla de conflicto.
- **Convención de paginación**: parámetros, envoltorio, límite, orden, ventana de tiempo.
- **Estado de operación**: planeada | construida | depreciada | retirada.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: El 100 % de las operaciones que los documentos del MVP implican para el backend
  tiene entrada en el mapa con consumidor, seguridad, feature y fuente; las tres construidas
  figuran como construidas.
- **SC-002**: Agregar una operación al contrato sin entrada en el mapa, o cambiarle el tag o el
  esquema, hace fallar `contract:check` en la primera corrida.
- **SC-003**: Cada convención (autenticación por consumidor, capacidades, idempotencia,
  paginación, ciclo de vida) tiene una decisión escrita y al menos una regla con fixture que
  la hace cumplir.
- **SC-004**: Un integrador puede responder, sólo con la documentación publicada, qué
  operaciones existen hoy, cuáles vendrán y cómo se autentica cada consumidor.
- **SC-005**: `contract:check`, `release-check` y la suite completa pasan; las tres operaciones
  construidas responden igual que antes (Schemathesis sin cambios).

## Assumptions

- El mapa vive junto al contrato (directorio `contracts/`) en un archivo declarativo propio,
  no dentro de `openapi.yaml`: el contrato describe lo que existe; el mapa, lo que existe y lo
  que va a existir.
- Las operaciones planeadas **no** se escriben en `openapi.yaml` (el servidor rechaza servir a
  medias; Redocly y los tipos generados no deben incluirlas); la documentación publicada las
  toma del mapa.
- Los nombres de las operaciones planeadas son tentativos: cambiar un nombre en el mapa antes
  de construirla es un cambio revisable, no incompatible.
- El esquema de plataforma es un secreto por merchant en header, rotable con dos activos, como
  la credencial del SDK pero nunca expuesto a un navegador; los detalles criptográficos
  (firma HMAC del cuerpo, ventana temporal) se deciden en esta feature y se implementan en la
  feature de outcomes.
- El esquema del portal y el de admin quedan propuestos (identidad de persona y de operador)
  hasta sus features; esta feature fija su forma y sus capacidades, no su implementación.
- La paginación es por cursor opaco con límite máximo de 100 por página y orden por instante
  descendente por defecto; la ventana de tiempo es un par `from`/`to` en RFC 3339.
- No cambia la versión mayor: todo lo que esta feature agrega al contrato es compatible.
