---
description: "Task list template for feature implementation"
---

# Tasks: El catálogo de mensajes

**Input**: Design documents from `/specs/027-catalogo-de-mensajes/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: sí, y son parte de cada historia. Esta feature toca el camino crítico de decisión y el
registro del ledger: nada entra sin prueba ejecutable.

**Organization**: por historia. El orden de seis pasos de toda feature que toca HTTP rige dentro de
cada una: mapa → contrato → `contract:check` → tipos → código → gates. **Los tipos generados nunca
se editan a mano.**

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1, US2, US3
- Toda tarea nombra su archivo

---

## Phase 1: Setup — el mapa del contrato, que va antes que todo

- [x] T001 `contracts/api-map.yaml` — **borrar la entrada de `publishMessageCatalog`**. No lleva
      `retired` con `retiredIn`: eso es para operaciones **publicadas**, y ésta nunca estuvo en el
      contrato. Una operación planeada que se cancela se saca del plan; el motivo vive en el
      research (R-01) y en el ADR del cierre.
- [x] T002 `contracts/api-map.yaml` + `src/interface-adapters/http/security/capabilities.ts` —
      `messages:publish` queda **sin ningún uso** (hoy aparece en el vocabulario del consumidor
      `admin`, en la operación borrada y en la réplica del mapa). Se va de los tres. Dejarla
      invitaría a construir la operación que acabamos de cancelar. La prueba de réplica falla si
      los dos lados no coinciden.
- [x] T003 `contracts/api-map.yaml` — la operación de lectura de los valores sin mapear entra como
      `planned`: consumidor `admin`, tag `admin`, capacidad `merchants:read` (la misma que
      `listAnchorDiagnostics`, que es su precedente), `roadmap: message-catalogue` y su fuente. US3
      la pasa a `built`. **Nada entra al contrato sin estar antes acá.**
- [x] T004 Verificar: `npm run check:api-map` en verde y el recuento de planeadas bajó en una neta.

---

## Phase 2: Foundational — lo único que puede existir sin consumidor

**Corrección medida, no opinión.** Esta fase pedía crear el módulo vacío en los tres anillos y
verificar los gates. **No se puede**, y los gates lo dijeron en dos pasos:

- `arch` rechaza un `index.ts` sin contenido (`no-orphans`): un anillo que no importa ni exporta
  nada no es un anillo.
- `check:dead-code` rechaza un archivo que nadie importa (`unused file`), así que tampoco sobrevive
  el dominio solo.

Es el repositorio teniendo razón: **un módulo sin consumidor es código muerto**, y andamiar primero
para llenar después es exactamente lo que estos gates existen para impedir. Lo que queda de la fase
es una línea, y el resto del módulo nace con su primer contenido real, en US1 (T022, T031, T034).

- [x] T005 `.dependency-cruiser.cjs` — entrada de `messages` en `CONTEXT_MAP` con
      `[shared-kernel, selection]`: necesita la familia de mensaje, que `selection` define, y nada
      más. **No depende de `catalog`**: recibe el valor de atributo ya resuelto, nunca el producto.
      Es inerte hasta que haya código, y por eso es lo único que puede ir antes.
- [x] T006 **Movida a US1** (T034): el módulo de composición y su línea en `deployments/local.ts`.
      Un módulo que no provee ni sirve nada es un marcador de posición, y entra cuando tiene algo.
- [x] T007 **Movida a US1** (T017 en adelante): el dominio del módulo nace con su primer consumidor.
- [x] T008 Verificado: `quality` (los siete gates) y `arch` en verde con la entrada del mapa sola.

**Checkpoint**: el mapa de contextos conoce al módulo. US1 lo hace existir.

---

## Phase 3: User Story 1 - El SDK muestra un texto real (Priority: P1) 🎯 MVP

**Goal**: la respuesta de una intervención lleva el texto que una persona escribió, y una familia
sin texto no es candidata.

**Independent Test**: provocar una intervención y comprobar que llega un texto mostrable; y que una
familia sin texto en el corpus no se elige, cayendo al escalón de abajo o a `NO_OP`
`message-unavailable`.

### Antes del contrato

- [x] T009 [P] [US1] `docs/dominio/` — nota por cada sustantivo nuevo: **texto curado**, **voz**,
      **versión de mensaje**. Cada una con su fuente (`01 §322`, `03 §4.4`). Sin esto
      `check:glossary` falla cuando el contrato los nombre.

### El contrato

- [x] T010 [US1] `contracts/components/schemas/Voice.yaml` — el vocabulario cerrado de voces, con
      **un solo valor** y su valor por defecto declarado. La clave existe desde el día uno (`SC-008`).
- [x] T011 [US1] `contracts/components/schemas/Intervention.yaml` — lleva el texto a mostrar, y su
      descripción **deja de decir** que «el texto lo sirve el catálogo de mensajes, no este
      contrato» (research R-05). `messageVersionId` **se conserva**: el texto es para renderizar, la
      versión para medir. El placeholder `msg_<barrier>_<anchor>_<step>_v0` sale de la descripción.
- [x] T012 [US1] `contracts/components/schemas/MerchantConfigurationDeclared.yaml` y
      `EffectiveConfiguration.yaml` — la voz del merchant y la versión del corpus que se le sirve.
      `Locales` **no se toca**: el idioma de reserva es uno y opcional, como `01 §14.2` lo decide.
- [x] T013 [US1] `contracts/no-op-reasons.yaml` — `message-unavailable`, emitido por `selection`,
      con la descripción que lo distingue de `no-acceptable-candidate`: uno es «ningún candidato
      tiene texto», el otro «ningún candidato tiene evidencia».
- [x] T014 [US1] `contracts/problem-types.yaml` — los errores del módulo que la configuración puede
      producir (`unknown-voice` para empezar; los de la correspondencia llegan en US2).
- [x] T015 [US1] Verificar: `npm run contract:check` en verde. Con `info.x-stability: building` el
      cambio de `Intervention` entra con bump MINOR conservando `/v1/` (ADR-003);
      `contract:diff` lo reporta y lo acepta. **Si agrega una regla nueva al ruleset, su fixture en
      `tests/contract-rules/fixtures/`.**
- [x] T016 [US1] `npm run contract:types`. **Nunca editar `generated/` a mano.**

### El dominio

- [x] T017 [P] [US1] `src/domain/messages/ids.ts` — `MessageVersion` como tipo marcado. Vive acá y
      no en el `shared-kernel` porque tiene un dueño (ADR-024).
- [x] T018 [P] [US1] `src/domain/shared-kernel/` — `VOICES` y su voz por defecto, réplica del
      esquema, con la prueba que verifica que coinciden (como `BARRIERS` y `ANCHORS`). Comprobar que
      `check:behaviour-constants` **no** lo marca: es un vocabulario replicado del contrato, no una
      constante de comportamiento.
- [x] T019 [US1] `src/domain/messages/curated-text.ts` — clase con `private constructor` y `of(...)`
      que devuelve `Result`. Rechaza: texto vacío o sólo espacios, más largo que el máximo del
      contrato, versión mal formada, y **un texto que contenga un marcador de interpolación sin
      resolver** — eso es una plantilla que alguien creyó que era prosa, y llegaría así a una persona
      (R-07).
- [x] T020 [US1] `src/domain/messages/message-outcome.ts` — unión discriminada (`Dressed` |
      `Unavailable`). No existe un `Dressed` con texto ausente (ADR-024).
- [x] T021 [US1] `src/domain/messages/errors.ts` — `UnknownVoice` con su `code` del catálogo y la
      unión del módulo. Un `DomainError` **se devuelve, nunca se lanza**.

### La aplicación y la resolución

- [x] T022 [US1] `src/application/messages/ports/message-corpus.ts` y `message-directory.ts` — los
      puertos, devolviendo `Promise`.
- [x] T023 [US1] `src/application/messages/services/message.service.ts` — resuelve el texto de una
      familia: idioma de la página → idioma de reserva; dentro del idioma resuelto, voz del merchant
      → voz por defecto. **Nunca un texto en otro idioma** (`FR-012`, `FR-013`, `FR-014`, `FR-015`).
- [x] T024 [US1] `src/application/decision/ports/` — el puerto que declara **quien lo necesita** y
      `messages` implementa, como `ingestion` declara `DecisionPlane` (ADR-026). Devuelve **lo que se
      puede decir**: los candidatos con su texto y su versión, en orden de escalera.

      **Corrección al plan**: decía `application/selection/ports/`, pero `selection` **no tiene capa
      de aplicación** — es dominio puro (`candidate.ts`, `profile.ts`, `quality-gate.ts`) y el
      orquestador lo invoca directo. El puerto va donde está su consumidor.

### El filtro, antes del gate

- [x] T025 [US1] **El quality gate no se toca.** Segunda corrección al plan, y quita riesgo en vez de
      agregarlo: `01 §322` dice que sin texto **la familia no es candidata**, así que nunca llega al
      juicio. No hace falta una clase de evidencia nueva, ni una razón de rechazo, ni cuidar que el
      gate siga siendo puro: no cambia una línea.
- [x] T026 [US1] `src/application/decision/services/decision.service.ts` — al armar el contexto, los
      candidatos de la barrera dominante se filtran a los que tienen texto, **conservando el orden de
      la escalera**, y recién entonces se juzgan. Vacío tras el filtro ⇒ `NO_OP`
      `message-unavailable`; no vacío pero todos rechazados ⇒ `no-acceptable-candidate`. Armar el
      contexto es lo que el principio I le permite al orquestador; **rankear no**, y el orden lo pone
      la escalera. Si el archivo pasa de 300 líneas, se extrae un servicio.
- [x] T027 [US1] `src/domain/selection/candidate.ts` — **`MESSAGE_PLACEHOLDER_VERSION` y
      `candidateId` desaparecen**. El id del candidato pasa a ser la familia; la versión del texto la
      trae el corpus. Es el síntoma que motivó la feature: mientras quede, no está hecha.

### El corpus y su lectura

- [x] T028 [US1] `config/` — el corpus como activo del release, con el mínimo para probar: un texto
      por familia en el idioma y la voz por defecto. Su fila en `config/README.md` (ADR-032) y la
      prueba del inventario en verde — **el archivo tiene que estar `git add`eado antes de correrla**,
      porque lee lo que git rastrea.
- [x] T029 [US1] `src/application/configuration/input/` y `src/composition/levels-config.ts` — el
      lector de forma del corpus; las **fábricas del dominio juzgan**, no el lector (ADR-024). Un
      valor fuera de rango es un `ConfigError` que nombra su campo.
- [x] T030 [US1] Las invariantes del corpus se verifican **al arrancar** y el servidor **no arranca**
      si falla alguna (constitución II): toda entrada nombra una familia que el plano puede elegir,
      un idioma bien formado y una voz que existe; ninguna versión se repite con texto distinto;
      existe al menos un texto por familia en el idioma y la voz por defecto.
- [x] T031 [US1] `src/interface-adapters/messages/gateways/` — el gateway del corpus sobre lo leído,
      y el enlace del puerto de lectura de la configuración del merchant desde el módulo
      `configuration`, como ya se hace con `PolicyDirectory`.

### El borde y el registro

- [x] T032 [US1] `src/interface-adapters/` — el DTO de la intervención lleva el texto. Sigue **sin
      llevar** barrera, brazo, experimento, política, margen ni escalón (`FR-024`): las reglas de
      exposición no cambian.
- [x] T033 [US1] `src/domain/ledger/decision.ts` — comprobar que `DecisionRecord.intervention` ya
      lleva la versión (la lleva, desde la 011) y que **el registro no incorpora el texto**: guarda
      la versión, y la versión es inmutable (`FR-018`, `FR-019`).
- [x] T034 [US1] `src/composition/modules/messages.ts` y `selection.ts` — el cableado completo.
      `bootstrap` sigue negándose a arrancar si el contrato declara una operación que nadie sirve.

### Pruebas de US1

- [x] T035 [P] [US1] `tests/unit/domain/messages/` — `CuratedText` (los cuatro rechazos, incluido el
      marcador de interpolación), `MessageOutcome`, la réplica de `VOICES` contra el esquema.
- [x] T036 [P] [US1] `tests/unit/application/messages/` — la resolución: idioma de la página, idioma
      de reserva, voz del merchant, voz por defecto, y **que nunca devuelve un texto de otro
      idioma**.
- [x] T037 [P] [US1] `tests/unit/domain/selection/` — el gate con la disponibilidad de texto: una
      familia sin texto se rechaza, y el gate **sigue siendo puro** (no recibe ningún puerto).
- [x] T038 [US1] `tests/integration/` — con `startTestApp()`: una intervención llega con texto; una
      familia sin texto cae al escalón de abajo; sin ninguna, `NO_OP` `message-unavailable`. Y **los
      presupuestos no se consumen** en ese caso.
- [ ] T039 [US1] `tests/unit/` — un corpus incoherente **no arranca el servidor**, con el mensaje que
      nombra qué entrada está mal.
- [ ] T040 [US1] Prueba de aislamiento entre merchants: dos merchants con voces distintas reciben
      textos distintos y ninguno ve la configuración del otro. **Toda feature que toca configuración
      la incluye.**

**Checkpoint**: el placeholder ya no existe y el SDK tiene qué mostrar. **Sola, esta historia ya
vuelve visible todo el plano de decisión.**

---

## Phase 4: User Story 2 - Dos productos dicen cosas distintas según sus atributos (Priority: P2)

**Goal**: la remera de algodón peinado habla de la tela y la básica no, sin redactar un texto por
producto.

**Independent Test**: dos productos que difieren sólo en el valor de un atributo mapeado reciben
textos distintos; agregar productos cuyos valores ya están mapeados no requiere redactar nada.

### Antes del contrato

- [ ] T041 [P] [US2] `docs/dominio/` — notas de **valor de atributo** y **correspondencia de
      valores**, con su fuente. El sustantivo es del vocabulario de OPE, **no** la etiqueta del
      merchant: la nota tiene que decir esa diferencia o nadie la va a respetar.

### El contrato

- [ ] T042 [US2] `contracts/components/schemas/` — el vocabulario cerrado de valores de atributo y la
      correspondencia que declara el merchant (sus etiquetas → valores de OPE), en
      `MerchantConfigurationDeclared` y `EffectiveConfiguration`.
- [ ] T043 [US2] `contracts/problem-types.yaml` + `x-invariants` — **dos invariantes que el esquema
      no expresa**, cada una con su tipo propio, su `422` y su ejemplo nombrándola: una
      correspondencia que nombre un valor fuera del vocabulario, y una etiqueta que apunte a dos
      valores. Toda `422` nombra en su ejemplo la invariante que la produce.
- [ ] T044 [US2] `tests/` — la prueba `[invariant:<slug>]` de cada una. `npm run
check:invariant-tests` falla si falta.
- [ ] T045 [US2] `npm run contract:check` y `npm run contract:types`.

### El dominio y la aplicación

- [ ] T046 [P] [US2] `src/domain/shared-kernel/` o `src/domain/messages/` — `ATTRIBUTE_VALUES`, el
      vocabulario cerrado, réplica del esquema con su prueba. **Arranca con los pocos valores para
      los que exista prosa curada** y crece por demanda, como barreras, anclajes y escalones.
- [ ] T047 [US2] `src/domain/messages/errors.ts` — `UnknownAttributeValue` y
      `DuplicateAttributeLabel`, con sus `code` del catálogo.
- [ ] T048 [US2] `src/domain/configuration/` — la correspondencia se juzga en su fábrica: cada valor
      existe en el vocabulario, ninguna etiqueta apunta a dos. `composition/` parsea la forma y
      construye por fábrica; un `fail` es un `ConfigError` que nombra el campo.
- [ ] T049 [US2] `src/domain/selection/candidate.ts` — el candidato que **afirma un atributo del
      producto** (`{ kind: "product-attribute", key }`). El tipo de claim y su juicio en el gate ya
      existen y no se tocan; lo que falta es que algún candidato lo declare.
- [ ] T050 [US2] `src/application/messages/services/message.service.ts` — el texto se elige por el
      valor de OPE al que la etiqueta del producto corresponde. **El valor crudo del merchant no se
      muestra nunca** (`FR-004`): o corresponde a un valor del vocabulario, o el producto no habla de
      eso.
- [ ] T051 [US2] Comprobar `FR-011` y **dejar escrito por qué se cumple**: una familia afirma una
      sola clave de atributo, así que no puede haber dos textos compitiendo en el mismo anclaje. Si
      resultara que sí puede, hace falta un orden determinista **y** su prueba.

### Pruebas de US2

- [ ] T052 [P] [US2] `tests/unit/domain/messages/` — el caso del copy de marketing: un atributo cuyo
      valor es «Algodón premium insuperable» **nunca** se muestra; o mapea a un valor de OPE y se usa
      la prosa de OPE, o el producto no habla de eso.
- [ ] T053 [P] [US2] `tests/unit/application/messages/` — dos productos que difieren sólo en el valor
      reciben textos distintos; el que no trae el atributo cae al escalón de abajo; dos etiquetas
      distintas mapeadas al mismo valor reciben **el mismo** texto; un valor sin mapear se comporta
      como si el atributo no estuviera.
- [ ] T054 [US2] `tests/integration/` — publicar una configuración con un valor desconocido responde
      `422` nombrando el valor; con una etiqueta duplicada, `422` nombrándola.
- [ ] T055 [US2] `tests/` — **el ejemplo del quickstart, ejecutable**: 12 productos, 7 etiquetas de
      tela, 4 frases de OPE, 5 líneas de correspondencia, **cero** textos por producto (`SC-002`).
      Y agregar productos con valores ya mapeados **no toca ningún archivo** (`SC-003`).

**Checkpoint**: el catálogo escala. US1 y US2 funcionan cada una por su cuenta.

---

## Phase 5: User Story 3 - El merchant se entera de lo que le falta mapear (Priority: P3)

**Goal**: qué valores aparecieron sin correspondencia, desde cuándo y a cuántos productos afecta.

**Independent Test**: publicar un catálogo con un valor sin mapear y verlo en el reporte con su
conteo; y comprobar que el reporte **nunca** rechaza ni demora la ingesta.

- [ ] T056 [US3] `config/platform.json` — el tope de valores conservados, como nivel plataforma.
      **No una constante** (constitución XI); `check:behaviour-constants` lo vigila.
- [ ] T057 [US3] `contracts/` — la operación de lectura pasa a `built` en el mapa y entra al
      contrato: `GET` paginada del consumidor `admin`, con `x-collection: true`, los parámetros
      `cursor`/`limit`/`from`/`to` por `$ref` y un `<X>Page` (`items`, `nextCursor?`). Si es la
      primera operación de su esquema de seguridad, referenciarlo desde la raíz — no lo es
      (`adminToken` ya está en uso).
- [ ] T058 [US3] `npm run contract:check` y `npm run contract:types`.
- [ ] T059 [US3] `src/application/messages/ports/unmapped-value-log.ts` y su gateway en
      `src/interface-adapters/messages/gateways/` — `upsert` conserva por merchant la etiqueta, el
      conteo de productos y el último instante, con el tope: alcanzado, **se descarta el más viejo y
      nunca se rechaza** (`FR-021`). Misma forma que `AnchorDiagnosticsStore`.
- [ ] T060 [US3] `src/interface-adapters/messages/controllers/<operacion>.ts` tipado con
      `OperationHandler<"<operationId>">`, su presenter en `messages/presenters.ts`, la paginación
      con `pageQueryOf`/`pageDto`/`merchantPageResponse` de `http/boundary.ts`, y el `merchantId` de
      la ruta con `merchantIdOf(req)`.
- [ ] T061 [US3] `src/composition/modules/messages.ts` — el handler declarado con `served(...)`. **No
      elige si se loguea ni si se audita**: la operación es de lectura, así que el contrato no manda
      auditarla, y eso lo deriva `contract:types`.
- [ ] T062 [P] [US3] `tests/unit/` — el tope: el más viejo se descarta, la ingesta nunca falla, y el
      conteo por etiqueta es correcto con productos repetidos.
- [ ] T063 [US3] `tests/integration/` — un operador lee el reporte de su merchant; uno fuera de
      alcance recibe `403 merchant-out-of-scope` con el mismo cuerpo que uno inexistente; un valor
      que después se mapea deja de figurar.

**Checkpoint**: el catálogo ya no se degrada en silencio.

---

## Phase 6: Cierre

- [ ] T064 `docs/adr/0NN-*.md` — el ADR, ahora que sus identificadores existen y
      `check:identifiers` puede verificarlos. Los tres motivos transversales (research R-08): el
      corpus es un activo del release y el merchant elige versión, voz e idiomas; sin texto la
      familia no es candidata; el vocabulario es cerrado y de OPE mientras la correspondencia es del
      merchant. Estado `propuesta` primero, `aceptada` al cerrar.
- [ ] T065 `CLAUDE.md` y `.claude/rules/` — **sólo si hace falta**, y el criterio de admisión decide:
      ¿hace falta en toda sesión (núcleo), es un procedimiento (skill) o es de una parte del código
      (regla acotada)? El núcleo está en 185 de 200 líneas. `npm run check:instructions` verifica la
      clasificación en los dos sentidos.
- [ ] T066 `npm run check:glossary`, `check:invariant-tests`, `check:identifiers`, `check:api-map`,
      `check:language`, `check:behaviour-constants`, `check:ports-bound` — los siete de gobernanza y
      calidad que esta feature puede romper, uno por uno antes de la cadena completa.
- [ ] T067 Correr el quickstart **entero**, sus once pasos, y dejar su tabla de estado **fechada**.
      El paso 11 no lo decide ningún comando: leer un texto del corpus y preguntarse si alguien lo
      escribiría así.
- [ ] T068 Cadena completa como CI: `format:check`, `quality`, `typecheck`, `test`, `test:tools`,
      `contract:check`, `test:contract`, `release-check`.
- [ ] T069 `npm run test:mutation` sobre las líneas cambiadas. Ante un superviviente, la skill
      `triaging-mutants`: describir el daño, clasificarlo **antes de tocar nada**, la prueba o la
      reestructuración según la clase, y confirmar con `--files`. La corrida completa la juzga CI.
- [ ] T070 **La verificación que ningún comando hace**: `grep` de `MESSAGE_PLACEHOLDER_VERSION` y de
      `msg_.*_v0` en `src/` y `contracts/` tiene que dar **nada**. Mientras quede una ocurrencia, la
      feature no está hecha.

---

## Dependencies & Execution Order

### Entre fases

- **Setup (F1)**: el mapa primero. T001 y T002 van juntos (la capacidad muere con su operación);
  T003 es independiente.
- **Foundational (F2)**: después de F1 y **bloquea todo**. Los tres archivos del módulo o no
  compila.
- **US1 (F3)**: la MVP. Dentro, el orden de seis pasos es inamovible: T009 (glosario) → T010–T015
  (contrato) → T016 (tipos) → T017–T034 (código) → T035–T040 (pruebas).
- **US2 (F4)**: después de US1, porque extiende el corpus y la resolución que US1 construye.
- **US3 (F5)**: independiente de US2. Sólo necesita F2 y el puerto de escritura que US2 alimenta —
  si se hiciera antes, el reporte estaría vacío pero funcionaría.
- **F6**: al final. T064 **después** de que existan los identificadores; T070 antes de declarar la
  feature terminada.

### Paralelismo real

- T009, T017, T018 y T041: archivos distintos, sin dependencia entre sí.
- Las pruebas marcadas `[P]` dentro de una historia: archivos distintos.
- US2 y US3 en paralelo, si hubiera dos personas: no comparten archivo salvo el módulo de
  composición.
- **Nunca en paralelo**: nada del contrato con su código. El contrato va primero, siempre.

---

## Implementation Strategy

### El MVP es US1

Sola ya arregla lo que motivó la feature: el plano de decisión funciona entero y por fin se ve. Si
la feature se interrumpiera ahí, lo entregado tiene valor completo.

### Commits

Uno por historia, más uno por cada cambio del contrato (para que el diff muestre que el contrato fue
antes que el código), más el del ADR. El retiro de `publishMessageCatalog` va en su propio commit:
es una decisión, no un detalle.

---

## Notes

- **El placeholder es el canario.** T070 existe porque un `grep` es más confiable que la memoria de
  quien cree haberlo sacado.
- **El gate de calidad tiene que seguir siendo puro.** Si al final recibe un puerto, la separación de
  autoridades se rompió y hay que volver a T025.
- **Los textos del corpus son prosa, no plantillas.** El rechazo de T019 es la única defensa
  mecánica; el resto lo decide quien lee.
- **Ninguna prueba existente debería cambiar de sentido.** `Intervention` gana un campo y el
  placeholder desaparece: si una prueba del plano de decisión cambia su expectativa de
  comportamiento —no de forma—, hay algo mal entendido.
- **`01 §322` y `01 §14.2` ya decidieron dos cosas que el plan había resuelto al revés.** Ante
  cualquier duda de alcance en esta feature, los documentos del MVP van **antes** que la spec y que
  el contrato.
