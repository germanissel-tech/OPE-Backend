# Feature Specification: Alineación con los documentos base del MVP (016)

**Feature Branch**: `016-alineacion-docs-base`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "Alineación del repositorio y de los documentos base del MVP con
las decisiones de la evaluación del 2026-09-20 (`docs/auditoria/2026-09-20-evaluacion-docs-base-vs-repo.md`,
doce decisiones del dueño). La base (`../README.md`, `01`–`04` y diagramas) sigue siendo la
fuente de verdad y se actualiza; el repo incorpora lo decidido; nada de lo que cambia de
alcance en otras features se implementa aquí. […] Intención del dueño: que la base y el repo
no se contradigan en ningún punto de la evaluación, que el roadmap refleje el criterio de
negocio (conectar cada merchant con la menor fricción para su plataforma […]) y que las tres
piezas de código que salen de las decisiones entren con sus pruebas."

## Contexto

La evaluación del 2026-09-20 cotejó los cinco documentos base del MVP y sus tres diagramas
con la constitución, los ADR, el glosario, el mapa del contrato y el código, y terminó en
doce decisiones del dueño (evaluación §2). Ocho son de documentación —de la base o del
repo—; tres producen código: el contrato adopta la cadena de evidencia de la base (decisión
7), el idioma de la página entra al contrato de evento (decisión 9) y un gate verifica que
todo identificador citado en los documentos exista en el contrato o en el código (decisión
12); y una reordena el roadmap y amplía el alcance de cinco features futuras sin
implementarlas (decisiones 1, 4, 5, 6, 9).

La constitución dice que ante conflicto entre ella y los documentos base "se corrige la
constitución o el documento, nunca se deja la contradicción". Esta feature es esa corrección,
en las dos direcciones, hecha de una vez y trazable a la evaluación.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Gobernanza del repo alineada (Priority: P1)

Como dueño del producto, quiero que la constitución, los ADR, el mapa del contrato y el
glosario digan lo que decidí el 2026-09-20 —y nada que lo contradiga—, para que la siguiente
feature que se especifique lo encuentre escrito con fuente y no lo rediscuta.

**Why this priority**: es lo que gobierna todo lo demás; sin esto, el contrato de la historia 2
y la edición de la base (historia 3) no tendrían un texto de referencia en el repo.

**Independent Test**: leer la constitución, los ADR tocados, el mapa y el glosario contra la
evaluación §2 y §5.2: cada decisión aparece con su fuente; `contract:check` (que incluye
`check:adrs`, `check:glossary`, `check:api-map`, `check:markers`) en verde.

**Acceptance Scenarios**:

1. **Given** la constitución v1.3.0, **When** se aplica esta historia, **Then** existe el
   principio XI "Ninguna política vive en el código" con los tres niveles y la regla de
   resolución (evaluación §2.2), la versión es 1.4.0 con su Sync Impact Report, y la sección
   "Contrato de datos" nombra las barreras `fit`, `price`, `returns`.
2. **Given** ADR-025 diciendo que el caso base construido es push, **When** se revisa,
   **Then** dice que push es un modo de la estrategia de sincronización por flujo, que los
   otros dos son pull y subscribe, que la combinación se negocia por merchant y que los
   adaptadores viven en OPE.
3. **Given** las cinco decisiones de producto de `04`, **When** se registran, **Then** existe un
   ADR que las declara confirmadas el 2026-09-20 con el texto de cada propuesta, y ADR-010
   remite D3–D6 a `01 §13` y ya no a `04`.
4. **Given** el roadmap del mapa, **When** se reordena, **Then** el orden es configuración →
   persistencia → puerto, estrategia por flujo y adaptadores → catálogo de mensajes → portal →
   observabilidad; esta feature tiene su número; cada feature reservada describe el alcance
   que la evaluación §5.2 le asigna; `check:api-map` en verde; ninguna prosa cita una feature
   por número salvo el mapa.
5. **Given** el glosario, **When** se completa, **Then** existen las notas de la estrategia de
   sincronización y del idioma de la página, con fuente, y las notas de orden verificada, orden
   atribuida y correlación pendiente describen la cadena de la decisión 7.

---

### User Story 2 - Contrato con la cadena de evidencia, idioma y gate de identificadores (Priority: P2)

Como integrador de la plataforma de un merchant, quiero que la respuesta a una orden diga en
qué estado de la cadena de evidencia quedó con el mismo vocabulario que los documentos del
MVP, y como SDK quiero poder declarar el idioma de la página; y como equipo quiero que ningún
documento cite un identificador que no exista.

**Why this priority**: son las tres piezas de código de la evaluación. El cambio de estado es
incompatible y conviene hacerlo antes de que haya un merchant conectado; el idioma es un campo
opcional que el catálogo de mensajes va a necesitar; el gate cierra el hueco que dejó pasar
`talle_calce` en la auditoría.

**Independent Test**: `contract:check` con el cambio incompatible aceptado por la marca `building`; pruebas de integración de
órdenes, corroboraciones y devoluciones con el vocabulario nuevo; una prueba de ingesta con
`locale`; la prueba del gate con un fixture que cita un identificador inexistente.

**Acceptance Scenarios**:

1. **Given** una orden sin sesión conocida, **When** la plataforma la notifica, **Then** la
   respuesta lleva `status: VERIFIED_ORDER` y `correlation: PENDING_CORRELATION`; **Given**
   una orden de una sesión en la que OPE decidió, **Then** `status: ATTRIBUTED_ORDER` y
   `correlation: ATTRIBUTED`; **Given** una devolución, **Then** `status: RETURNED` con la
   `correlation` de la orden intacta.
2. **Given** el contrato 1.2.0 sin merchants que lo consuman, **When** cambia el vocabulario
   de `status`, **Then** el contrato declara que está en construcción (`info.x-stability:
building`), la versión es `1.3.0`, las rutas siguen en `/v1/`, `contract:diff` reporta el
   cambio como incompatible **y** lo acepta por la marca; `release-check` avisa que la marca
   sigue puesta; los tipos generados, los controllers y las pruebas usan sólo el vocabulario
   nuevo. (Decisión del dueño del 2026-09-20: en construcción no se salta de versión mayor;
   la marca se quita antes del primer piloto y desde entonces rige ADR-003 sin excepción.)
3. **Given** un lote de eventos con `page.locale: "es-AR"`, **When** se ingiere, **Then** se
   acepta, el valor viaja hasta el contexto de la decisión y el registro del ledger lo conserva;
   **Given** un `locale` que no es una etiqueta BCP 47 válida, **Then** 400 `validation-failed`
   nombrando el campo; **Given** un lote sin `locale`, **Then** se acepta como hasta hoy.
4. **Given** un documento que cita entre comillas de código un identificador que no existe en
   el contrato ni en `src/`, **When** corre `check:identifiers`, **Then** falla nombrando archivo,
   línea e identificador; **Given** el repo tras esta feature, **Then** `check:identifiers` pasa
   y `contract:check` lo incluye.

---

### User Story 3 - Los documentos base al día (Priority: P3)

Como stakeholder que lee `01`–`04` y el `README`, quiero encontrar el estado real de OPE y las
decisiones tomadas, para que lo que lea coincida con lo que el repo hace y con lo que voy a
negociar con un merchant.

**Why this priority**: la base es lo que ve el stakeholder y el merchant; queda última porque
depende del texto que las historias 1 y 2 fijan en el repo, y porque sus archivos viven fuera
del repositorio.

**Independent Test**: releer cada punto de la evaluación §5.1 contra el documento editado; los
diagramas se compilan con `archify` sin error; `check:glossary` sigue resolviendo las fuentes
`mvp:` que el glosario cita (las secciones citadas siguen existiendo con el mismo número).

**Acceptance Scenarios**:

1. **Given** el `README` de la base, **When** se actualiza, **Then** dice la fecha, que D1 y D2
   están cerradas, que las features construidas y planificadas se leen en el mapa del contrato,
   y el estado de cada verificación V1–V6.
2. **Given** `01 §10.3`, **When** se edita, **Then** lista siete campos con la frase de que el
   incentivo aplicado es un dato de OPE; **Given** `01 §3.2` y `§9`, **Then** llevan la nota de
   que las garantías de durabilidad entran con la feature de persistencia; **Given** `01 §3.1.1`,
   `§4.4`, `§14.1`, `§14.2`, **Then** dicen `locale`, mensajes por idioma, nivel 3 alcanzable con
   suscripción e idiomas del merchant.
3. **Given** `02 §4` y `§6`, **When** se editan, **Then** describen la estrategia por merchant y
   por flujo con tres modos y dicen que push es el genérico ya construido.
4. **Given** `03 §4.13` y `§6`, y `04`, **When** se editan, **Then** el adaptador de prueba y la
   verificación documental van "con la feature del puerto", y las cinco decisiones figuran
   confirmadas el 2026-09-20.
5. **Given** los tres diagramas, **When** se editan sus fuentes, **Then** muestran los tres
   modos, claves de ingesta y de plataforma en vez de "token", la persistencia como feature y
   `locale` en el contexto, y compilan.

---

### Edge Cases

- Un identificador citado en un documento existe en el contrato con otra forma (`fit` frente
  a `talle_calce`): el gate lo señala como inexistente; no hay tabla de sinónimos.
- Un identificador citado sólo existe en una prueba o en un fixture: no cuenta; el gate busca
  en el contrato y en `src/`.
- Una palabra entre comillas de código que no es un identificador (una ruta, un comando, un
  valor de ejemplo, un nombre de archivo): el gate la ignora por forma (contiene `/`, `.`,
  espacios, `npm`, `--`) o por lista de exclusión con motivo; la lista no admite entradas sin
  motivo.
- La renumeración del roadmap cambia el número de features que otras prosas citan: sólo el
  mapa cita por número (015 ya movió la prosa a nombres); `check:api-map` verifica que toda
  operación planificada apunte a una feature que exista.
- `contract:diff` compara contra `main` (1.2.0): el cambio es incompatible por definición y
  el gate lo acepta sólo porque el contrato está marcado `building`; sin la marca, falla.
- Un consumidor que mande `locale` con mayúsculas o subetiquetas raras pero válidas
  (`es-419`, `pt-BR`, `zh-Hant-TW`): se acepta; la validación es de forma, no de lista.
- La carpeta `../` no está autorizada en la sesión: la historia 3 se detiene al primer archivo
  y lo dice, sin tocar el repo.

## Requirements _(mandatory)_

### Functional Requirements

**Gobernanza del repo (historia 1)**

- **FR-001**: La constitución MUST incorporar el principio XI con el texto de la evaluación
  §2.2 (tres niveles: plataforma, default de tratamiento, merchant; orden de resolución; lo
  que queda en el código: invariantes y algoritmos; lo que se estampa y congela), como versión
  MINOR con su Sync Impact Report.
- **FR-002**: La constitución MUST nombrar las barreras con los identificadores del contrato
  (`fit`, `price`, `returns`) y el nombre en castellano sólo como prosa (versión PATCH,
  acumulada con FR-001 en 1.4.0).
- **FR-003**: ADR-025 MUST decir que push es un modo de la estrategia de sincronización por
  merchant y por flujo, junto a pull y subscribe, negociada con cada merchant, con los
  adaptadores en OPE y un puerto único por el que entran los cuatro flujos; y MUST conservar
  como vigente lo construido (snapshot completo, `capturedAt`, firma).
- **FR-004**: Un ADR nuevo MUST registrar las decisiones de producto D-B, D-C, D-E, D-F y D-G
  como confirmadas por el dueño el 2026-09-20, con la propuesta de cada una y su consecuencia
  para el repo; ADR-010 MUST remitir D3–D6 a `01 §13` y citar el ADR nuevo.
- **FR-005**: El mapa del contrato MUST listar esta feature con su número y las reservadas en
  el orden configuración → persistencia → puerto, estrategia por flujo y adaptadores → catálogo
  de mensajes → portal → observabilidad, con las descripciones de la evaluación §5.2; toda
  operación planificada MUST apuntar a una feature existente.
- **FR-006**: El glosario MUST ganar las notas `estrategia de sincronización` y `locale`
  (idioma de la página), con fuente, y MUST actualizar `orden verificada`, `orden atribuida` y
  `correlación pendiente` a la cadena de la decisión 7.

**Contrato, idioma y gate (historia 2)**

- **FR-010**: La respuesta de una orden y de una devolución MUST llevar `status` con los
  valores `VERIFIED_ORDER`, `ATTRIBUTED_ORDER`, `RETURNED` y `correlation` con
  `PENDING_CORRELATION` o `ATTRIBUTED`; una orden sin correlación es `VERIFIED_ORDER` +
  `PENDING_CORRELATION`; con correlación, `ATTRIBUTED_ORDER` + `ATTRIBUTED`; devuelta,
  `RETURNED` con la `correlation` que tenía.
- **FR-011**: El cambio MUST publicarse con la marca `info.x-stability: building` y un bump
  MINOR (1.3.0) conservando `/v1/` mientras ningún merchant consuma el contrato (ADR-003,
  precisión del 2026-09-20), MUST reflejarse en tipos generados, controllers, cliente y
  pruebas, y MUST dejar `contract:check` en verde con el cambio incompatible reportado y
  aceptado por la marca; `release-check` MUST avisar mientras la marca exista.
- **FR-012**: El contexto de página de todo evento MUST admitir `locale` opcional, etiqueta
  BCP 47 validada por forma, en la lista blanca del contrato; MUST llegar al contexto de la
  decisión y al registro de la decisión en el ledger; MUST NOT cambiar ninguna decisión hasta
  que exista el catálogo de mensajes por idioma.
- **FR-013**: Un gate `check:identifiers` MUST fallar cuando un identificador citado entre
  comillas de código en la constitución, un ADR o una nota del glosario no existe con ese
  nombre exacto en el contrato ni en `src/`; MUST ignorar por forma lo que no es un
  identificador y MUST exigir motivo a toda exclusión; MUST tener fixture positivo y negativo
  y prueba; MUST correr dentro de `contract:check`.

**Base (historia 3)**

- **FR-020**: Los documentos base MUST editarse en los puntos de la evaluación §5.1 y en
  ningún otro; MUST conservar la numeración de secciones que el glosario cita como fuente;
  MUST marcar cada afirmación nueva con `DECIDIDO` y la fecha; MUST NOT introducir cifras de
  estado que el repo informa (número de features, pruebas, ADR), sino remitir al mapa.
- **FR-021**: Los diagramas MUST editarse en sus fuentes (`.architecture.json`,
  `.sequence.json`) y MUST compilar con la herramienta que el `README` de la base indica; el
  HTML generado MUST regenerarse.

**Transversales**

- **FR-030**: Todo gate del repo MUST estar en verde al cierre de cada historia; cero
  excepciones nuevas de lint, idioma o mutación; un commit por historia, en español.
- **FR-031**: Nada de lo que la evaluación asigna a otra feature (modos pull/subscribe,
  refresco parcial, persistencia, catálogo por idioma, configuración en tres niveles, portal,
  verificación documental de Magento 2 y VTEX) MUST implementarse aquí; su alcance se escribe
  en el mapa.

### Key Entities

- **Decisión de la evaluación**: una de las doce (evaluación §2), con su fuente en la base y
  su consecuencia en el repo; toda edición de esta feature cita la suya.
- **Estado de la cadena de evidencia**: `VERIFIED_ORDER`, `ATTRIBUTED_ORDER`, `RETURNED`;
  **Correlación**: `PENDING_CORRELATION`, `ATTRIBUTED`. Dos ejes: lo que la plataforma confirmó
  y lo que OPE pudo vincular.
- **Idioma de la página (`locale`)**: etiqueta BCP 47 que el SDK lee de la página; contexto de
  la interacción, no dato personal; sin efecto en la decisión hasta el catálogo por idioma.
- **Identificador citado**: palabra entre comillas de código en un documento del repo que
  nombra algo del contrato o del código; existe con ese nombre o el gate falla.
- **Modo de sincronización**: `push`, `pull`, `subscribe`, por flujo (catálogo, stock/precio,
  órdenes, devoluciones), negociado por merchant; en esta feature sólo como texto.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Las doce decisiones de la evaluación tienen su texto en el repo (constitución,
  ADR, mapa o glosario) o en la base, citable, y ninguna afirmación de la evaluación §2 queda
  contradicha por un documento de cualquiera de los dos lados.
- **SC-002**: Una relectura de la evaluación §2 contra los documentos editados no encuentra
  ninguna de las doce diferencias.
- **SC-003**: El contrato publica la cadena de evidencia con el vocabulario de `01 §5`; las
  pruebas de integración de órdenes, corroboraciones y devoluciones pasan con el vocabulario
  nuevo sin perder ningún caso.
- **SC-004**: `check:identifiers` en verde sobre todo el repo y en rojo sobre su fixture
  negativo; el caso `talle_calce` no puede repetirse.
- **SC-005**: Todos los gates del repo en verde al cierre de cada historia, con cero
  excepciones nuevas; `test:mutation` sin supervivientes en las líneas nuevas.
- **SC-006**: Los diagramas compilan y el `README` de la base tiene fecha del cierre.

## Assumptions

- La evaluación del 2026-09-20 es el insumo completo: no se reabren sus decisiones; una
  decisión nueva que aparezca durante la implementación se escribe en el quickstart y se
  consulta al dueño.
- El número de esta feature es el siguiente de `specs/` (016); las features reservadas del
  mapa corren un número, una sola vez, en la historia 1.
- No hay merchants conectados: el contrato está en construcción y lo declara; `/v1/` se
  conserva y el salto de versión mayor queda para cuando haya un consumidor real.
- `locale` se valida por forma (patrón BCP 47), no contra una lista de idiomas; el merchant
  declara los suyos en la feature de configuración.
- El gate de identificadores lee la constitución, `docs/adr/` y `docs/dominio/`; los specs y
  los informes de auditoría quedan fuera porque citan por diseño cosas que ya no existen o que
  todavía no existen.
- La edición de la base requiere autorizar la carpeta `../` en la sesión; si no se autoriza,
  la historia 3 queda documentada como pendiente en el quickstart y la feature cierra con las
  dos primeras.
- Los diagramas se compilan con `archify` según el `README` de la base; si la herramienta no
  está disponible en la máquina, la fuente se edita igual y la compilación queda anotada como
  pendiente.
