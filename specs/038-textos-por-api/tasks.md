---
description: "Task list template for feature implementation"
---

# Tasks: Los textos se editan por API, en la capa base y en la de cada merchant

**Input**: Design documents from `/specs/038-textos-por-api/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/http.md](./contracts/http.md), [quickstart.md](./quickstart.md)

**Tests**: sí, y antes del código en cada pieza con regla: la clave, la versión, la completitud, el
alcance, el decorador. Lo que cruza un reinicio, en `durability`; las historias de punta a punta, en
`integration`.

**Organization**: por historia. **Esta feature toca HTTP**, así que el orden de seis pasos de
`.claude/rules/contrato.md` rige en cada historia que agrega una operación: mapa → contrato →
`contract:check` → tipos → código → gates. Las seis operaciones entran al mapa como `planned` en la fase
1 y cada historia pasa las suyas a `built` cuando las sirve, porque el arranque se niega si el contrato
declara una operación que ningún módulo sirve.

**Y la 036 se toca en dos lugares** —el reinicio de ventanas extraído y el decorador alrededor de sus dos
publicaciones— sin cambiar su comportamiento: sus pruebas de integración son la red y corren en cada
fase que las roza.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivo distinto, sin dependencia)
- **[Story]**: US1 (texto base), US2 (texto del merchant), US3 (motivo y ventana), US4 (idioma sin textos),
  US5 (historial)
- Toda tarea nombra su archivo

---

## Phase 1: El mecanismo (bloquea las cinco historias)

**Goal**: la clave, la versión, las dos capas y la completitud como reglas del dominio; un almacén que las
conserve y sirva el corpus desde memoria; la semilla sin voz; el reinicio de ventanas en su dueño. Sin
ninguna operación HTTP todavía, y con la voz retirada del código.

**Independent Test**: una versión se publica y se lee por el puerto, sobrevive un reinicio, el corpus
resuelve merchant antes que base dentro de cada idioma, la semilla se importa una vez, y las pruebas de la
036 siguen en verde con el reinicio extraído.

### El mapa y el dominio

- [x] T001 `contracts/api-map.yaml` — las **seis** operaciones como `planned` (paso 0): `publishText`,
      `listTextVersions`, `getTextVersion`, `publishMerchantText`, `listMerchantTextVersions`,
      `getMerchantTextVersion`, con consumidor `admin`, tag, capacidades nuevas `texts:write` /
      `texts:read` en `consumers.admin.capabilities`, `roadmap` y fuente. `npm run check:api-map`.
- [x] T002 [P] `tests/unit/domain/messages/text-key.test.ts` — **antes de la clase**: una familia fuera
      del vocabulario de candidatos falla nombrándola; un valor fuera del de atributos, ídem; una familia
      sin atributo rechaza un valor; una que habla de atributo lo exige; un idioma por forma (el patrón de
      `Locales`); `rehydrate` no re-juzga.
- [x] T003 `src/domain/messages/text-key.ts` y `src/domain/messages/errors.ts` — `TextKey` como clase
      (ADR-024) juzgada contra `CANDIDATES` (selection) y `ATTRIBUTE_VALUES`; `TextKeyUnknown` con la
      parte que falla en `details`. Exportado por el `index.ts` del módulo.
- [x] T004 [P] `tests/unit/domain/messages/text-version.test.ts` — **antes de la clase**: una versión
      «quitado» sólo existe en la capa de un merchant (`BaseTextRequired` en la base); el identificador
      de versión se deriva de capa, clave y número y **no lleva voz**; `record()` declara el texto como
      registro plano y `rehydrate` lo convierte (feature 037); `sameTextAs` para repetir.
- [x] T005 `src/domain/messages/text-version.ts` — la entidad: `private constructor`, `of(...)` que
      devuelve `Result`, `rehydrate`, `record()`, y la derivación del identificador que una intervención
      estampa (`messageVersionId`). El número **no** se declara: lo acuña el almacén.
- [x] T006 [P] `tests/unit/domain/messages/completeness.test.ts` — **antes de mudar la regla**: dado un
      idioma y lo vigente de la base, qué familias **incondicionales** faltan; una familia que habla de
      atributo no cuenta (R-01); vacío es completo.
- [x] T007 `src/domain/messages/completeness.ts` — la regla mudada desde `composition/corpus-config.ts`
      como método de quien lo sabe, no como función suelta (`src/domain/` no exporta funciones sueltas):
      un conjunto de textos vigentes sabe qué le falta para un idioma.

### La voz se retira

- [x] T008 `src/domain/shared-kernel/voice.ts`, `src/application/messages/ports/message-corpus.ts`,
      `src/application/messages/ports/message-directory.ts`,
      `src/interface-adapters/configuration/gateways/message-settings.ts` — se retira el tipo `Voice` y
      `DEFAULT_VOICE`; `TextKey` del puerto pierde `voice` y gana `merchantId`; `MessageSettings` pierde
      `voice`. Lo que compila después de esto es la lista de sitios que la nombraban.
- [x] T009 [P] `docs/dominio/voz.md` y `docs/dominio/version-de-mensaje.md` — la voz se retira del
      glosario (ADR-008) y la versión de mensaje pasa a derivarse de capa, clave y número; nota nueva
      `docs/dominio/capa-de-texto.md` para el sustantivo nuevo (paso previo al contrato de la regla).
      `check:identifiers` verifica lo citado.

### El reinicio de ventanas, en su dueño

- [x] T010 `tests/unit/domain/experiment/experiment.test.ts` — **antes de tocar la entidad**: un reinicio
      con causa de texto guarda la clave y la capa; un registro **sin** causa (escrito por la 036) se
      rehidrata y se lee igual que hoy.
- [x] T011 `src/domain/experiment/experiment.ts` — `WindowRestart` gana `cause` (configuración o texto,
      discriminada por `kind`) conservando `level` y `configurationVersion`; `windowRestarted` la recibe.
- [x] T012 `tests/unit/application/experiment/window-restarts.test.ts` — **antes del servicio**: reinicia
      cada experimento activo con la causa dada y escribe cada uno; uno que no está activo no se toca; un
      almacén que rechaza devuelve `StoreUnavailable`.
- [x] T013 `src/application/experiment/services/window-restarts.service.ts` — `WindowRestarts`, extraído
      de `ReachedExperiments.restart` (036). Exportado por el índice de `experiment`.
- [x] T014 `src/application/configuration/services/reached-experiments.service.ts` y
      `src/composition/modules/configuration.ts` — `ReachedExperiments` pierde el reinicio y lo pide a
      `WindowRestarts`, pasando la causa de configuración. `npx vitest run tests/integration/levels.test.ts
tests/integration/admin-configuration.test.ts` **sin cambios de expectativa**: es la red.

### El almacén

- [x] T015 `src/application/messages/ports/text-store.ts` — el puerto: publicar (numerando por capa y
      clave, con «quitado» como una versión), lo vigente de una capa entera, el historial de una clave
      paginado, una versión, y qué familias faltan en la base para un idioma. `Result` con
      `StoreUnavailable` en las escrituras (ADR-021).
- [x] T016 `tests/unit/interface-adapters/messages/memory-text-store.test.ts` y
      `src/interface-adapters/messages/gateways/memory-text-store.ts` — el gateway en memoria, que
      **también sirve `MessageCorpus`**: merchant primero y base después para una clave y un idioma.
      Reemplaza `memory-message-corpus.ts`, que se retira.
- [x] T017 `migrations/006-texts.sql` — la tabla de `data-model.md`: capa y valor de atributo con
      centinela y no `NULL` (un índice único trata los `NULL` como distintos), clave `(layer, family,
attribute_value, locale, version)`, las dos columnas del dueño, `PRAGMA user_version = 6`. Con
      su fila en el inventario de `migrations/README.md`.
- [x] T018 `tests/unit/interface-adapters/messages/sqlite-text-store.test.ts` — con el doble de
      `tests/helpers/sql-store.ts`: llena su índice una vez al construirse y nunca vuelve a leer la tabla
      para resolver; toca el índice **después** de que el almacén aceptó y nunca antes (ADR-041); una
      escritura rechazada deja el índice intacto.
- [x] T019 `src/interface-adapters/messages/gateways/sqlite-text-store.ts` — el gateway durable:
      `MAX(version)+1` **dentro de la transacción** por capa y clave, `record()` al escribir,
      `rehydrate` sobre el documento al leer (feature 037: ninguna parte a mano), el índice de lo vigente
      mantenido con `store.committed`, y el corpus servido desde ese índice.
- [x] T020 `tests/durability/texts.test.ts` — lo que sólo se ve contra un almacén de verdad: las versiones
      y lo vigente cruzan un reinicio; «quitado» cruza un reinicio y resuelve a la base; dos publicaciones
      no comparten número; un merchant no ve el texto de otro; una escritura rechazada degrada al canal
      del puerto y no deja índice.
- [x] T021 `tests/architecture/storage-inventory.test.ts` — el almacén nuevo gana su fila
      (`born-durable`), en los dos sentidos.
- [x] T022 `tests/durability/query-plans.test.ts` — el historial de una clave y la carga de lo vigente
      usan el índice, sobre tablas con filas.

### La semilla y la resolución

- [x] T023 `config/messages.json` y `src/composition/corpus-config.ts` — la semilla pierde `voice`; el
      lector juzga sólo la **forma** y deja de juzgar la completitud, que se muda al caso de uso de
      importación. Fila de `config/README.md` reescrita: es semilla, se aplica una vez.
- [x] T024 `tests/unit/application/messages/import-texts.test.ts` y
      `src/application/messages/use-cases/import-texts.use-case.ts` — importa la semilla sólo en un
      almacén vacío, a nombre del sistema, juzgando la completitud contra los idiomas que recibe en el
      request (los de los niveles sembrados: la composición los calcula, porque `messages` no depende de
      `configuration`); una semilla incompleta no arranca (constitución II); un almacén con textos la deja
      y lo dice.
- [x] T025 `src/composition/bootstrap.ts` y `src/composition/modules/messages.ts` — el corpus deja de
      venir de `CorpusPort`; `messages` gana tabla por tecnología (memoria y SQLite) y la importación de la
      semilla entra en `importSeed` **después** de los niveles, que son los que dicen qué idiomas juzgar.
      `tests/integration/bootstrap.test.ts`: dos arranques, el segundo no importa y lo dice (SC-008).
- [x] T026 `.dependency-cruiser.cjs` — `messages` gana `operator`, `merchant` y `experiment` en
      `CONTEXT_MAP` (R-02). `npm run arch` en verde.
- [x] T027 `tests/unit/application/messages/message.service.test.ts` y
      `src/application/messages/services/message.service.ts` — dentro de cada idioma, primero el texto
      del merchant y después el base; el orden de idiomas no cambia; el caso de la spec: merchant
      personalizado en español con la página en inglés muestra la base en inglés.
- [x] T028 Correr `npm run format:check && npm run quality && npm run typecheck && npm test` y
      `npx vitest run --project durability`: el mecanismo está, la voz no compila en ningún sitio, y nada
      de HTTP cambió todavía.

**Checkpoint**: se puede publicar y leer una versión por el puerto, el corpus resuelve por capas, la
semilla se importa una vez, y la 036 sigue en verde con el reinicio en `experiment`.

---

## Phase 2: User Story 1 — Un operador edita un texto base (P1) 🎯 MVP

**Goal**: publicar un texto base por la API, verlo en la intervención siguiente con su versión, y que
quede en el registro.

**Independent Test**: quickstart pasos 1 a 3 para la base; `tests/integration/messages/base-text.test.ts`.

- [ ] T029 [US1] `contracts/` — `publishText` pasa a `built`: `paths/admin-texts.yaml`, esquemas
      `TextInput`, `TextVersion`, `PublishedText`, tipos de problema `text-key-unknown` y
      `base-text-required` en `problem-types.yaml` con su `x-invariants`, `x-idempotency` con clave
      `text`; `Intervention.messageVersionId` sube su `maxLength`; `Voice.yaml` se retira. `npm run
contract:check && npm run contract:types`. Fixture en `tests/contract-rules/fixtures/` si una regla
      lo pide.
- [ ] T030 [US1] `tests/unit/application/messages/reached-by-text.test.ts` — **antes del servicio**: un
      texto base alcanza a los experimentos activos de los merchants **sin** texto propio vigente en esa
      clave e idioma; con texto propio, fuera; en calibración, fuera; un texto de merchant alcanza sólo a
      los de ese merchant.
- [ ] T031 [US1] `src/application/messages/services/reached-by-text.service.ts` — `ReachedByText` con los
      merchants, el directorio de experimentos, el almacén de textos y `WindowRestarts` (R-03, R-04): `by`
      y `restart` con causa de texto. Cuatro interfaces en un servicio para que el caso de uso lo pida en
      una dependencia.
- [ ] T032 [US1] `tests/unit/application/messages/publish-text.test.ts` — **antes del caso de uso**:
      alcance total o `OperatorScopeTooNarrow`; clave inválida; texto inválido (los tres errores del
      texto); repetido no crea versión y lo dice; sin experimentos alcanzados no pide motivo; con
      alcanzados y sin motivo, `ConfigurationFrozen`; con motivo, publica y reinicia; el almacén que
      rechaza devuelve `StoreUnavailable`.
- [ ] T033 [US1] `src/application/messages/use-cases/publish-text.use-case.ts` — `PublishTextUseCase`
      con `{ texts, reached, clock }` y `publishedBy` (036) para los cuatro hechos de la publicación.
      Devuelve, nunca lanza (ADR-023).
- [ ] T034 [P] [US1] `src/interface-adapters/messages/controllers/publish-text.ts` y
      `src/interface-adapters/messages/presenters.ts` — `OperationHandler<"publishText">`: DTO → request,
      `201`/`200` por `outcome`, `toProblem` en fallo. El presenter de una versión, que las seis operaciones
      comparten.
- [ ] T035 [US1] `src/composition/modules/messages.ts` — `serves.handlers.publishText` con `served(...)`;
      el módulo no elige si se audita: el mapa ya lo dice.
- [ ] T036 [US1] `tests/integration/messages/base-text.test.ts` — historia 1 de punta a punta en memoria:
      los siete escenarios de la spec, incluido el que publica un idioma no soportado y se acepta, y el
      del almacén que no escribe (ni versión ni auditoría: `tests/helpers/unavailable-ledgers.ts`).
- [ ] T037 [US1] `tests/integration/isolation.test.ts` — la operación nueva entra a la suite de
      aislamiento entre merchants, como toda operación de administración.
- [ ] T038 [US1] `npm run test:mutation` acotado al diff de la historia.

**Checkpoint**: un texto base se corrige desde la API y la intervención siguiente lo muestra.

---

## Phase 3: User Story 2 — Un merchant tiene su propio texto, y puede volver a la base (P1)

**Goal**: publicar y quitar el texto de un merchant, resuelto antes que la base sólo para él.

**Independent Test**: quickstart paso 3 para el merchant; `tests/integration/messages/merchant-text.test.ts`.

- [ ] T039 [US2] `contracts/` — `publishMerchantText` pasa a `built`: `paths/admin-merchant-texts.yaml`,
      `MerchantTextInput` con `text` nullable (`null` quita), `merchantId` por `$ref` del parámetro.
      `contract:check` y `contract:types`.
- [ ] T040 [US2] `tests/unit/application/messages/publish-merchant-text.test.ts` — **antes del caso de
      uso**: alcance sobre el merchant por `ScopedMerchants` (`MerchantOutOfScope`); publicar; quitar es
      una versión «quitado»; quitar lo que no existe o ya está quitado repite; alcanzados son los de ese
      merchant.
- [ ] T041 [US2] `src/application/messages/use-cases/publish-merchant-text.use-case.ts` —
      `PublishMerchantTextUseCase` con `{ scoped, texts, reached, clock }`. Un caso de uso propio y no
      una rama del anterior: el alcance, la capa y «quitar» son tres diferencias, no una.
- [ ] T042 [P] [US2] `src/interface-adapters/messages/controllers/publish-merchant-text.ts` — el
      controller; `text: null` viaja como «quitar» al request.
- [ ] T043 [US2] `src/composition/modules/messages.ts` — `serves.handlers.publishMerchantText`.
- [ ] T044 [US2] `tests/integration/messages/merchant-text.test.ts` — los seis escenarios de la spec:
      sólo ese merchant lo ve; el idioma manda; quitar vuelve a la base y queda en el historial; fuera de
      alcance; un texto base nuevo no alcanza al que tiene propio; nada cruza merchants.
- [ ] T045 [US2] `tests/integration/isolation.test.ts` — la operación de merchant entra a la suite.
- [ ] T046 [US2] `npm run test:mutation` acotado al diff de la historia.

**Checkpoint**: las dos capas funcionan por API, con el idioma mandando sobre la personalización.

---

## Phase 4: User Story 3 — Motivo y ventana con experimentos activos (P1)

**Goal**: la regla de la 036 aplicada a los textos con su definición de alcanzado, probada de punta a
punta.

**Independent Test**: quickstart paso 4; `tests/integration/messages/frozen.test.ts`.

- [ ] T047 [US3] `tests/integration/messages/frozen.test.ts` — los seis escenarios de la spec: sin
      motivo `409 configuration-frozen`; con motivo, versión creada, ventana reiniciada **con causa de
      texto** en el experimento, motivo en el registro; merchant con texto propio no alcanzado por la base;
      texto de merchant alcanza sólo al suyo; diez publicaciones seguidas dejan la ventana reiniciada en la
      última; calibración no bloquea.
- [ ] T048 [US3] `src/interface-adapters/experiment/presenters.ts` y la lectura de experimentos — si el
      historial de reinicios se muestra, la causa de texto se presenta con su clave; si no se muestra, se
      deja dicho dónde en el contrato.
- [ ] T049 [US3] `npm run test:mutation` acotado al diff de la historia.

**Checkpoint**: ningún cambio de texto pasa desapercibido con una medición en curso.

---

## Phase 5: User Story 4 — Un idioma no se soporta sin textos (P2)

**Goal**: la comprobación cruzada al publicar idiomas, como decorador, sin que crezcan los casos de uso
de la 036.

**Independent Test**: quickstart paso 5; `tests/integration/configuration/complete-locales.test.ts`.

- [ ] T050 [US4] `contracts/` — `publishTreatmentDefaults` y `publishMerchantConfiguration` ganan
      `422 locale-incomplete` con su `x-invariants` (sobre la operación: depende de otro recurso) y el tipo
      en `problem-types.yaml` con las familias que faltan en `details`. `contract:check`, `contract:types`.
- [ ] T051 [US4] `src/application/configuration/ports/text-completeness.ts` — el puerto que
      `configuration` pregunta: qué familias faltan en la base para un idioma. Lo implementa el almacén de
      textos; la composición enlaza.
- [ ] T052 [US4] `tests/unit/application/configuration/complete-locales.test.ts` — **antes del
      decorador**: juzga sólo los idiomas que **entran** (soportado nuevo o reserva nueva); uno que ya
      estaba no se vuelve a juzgar; quitar uno no pide nada; rechaza con `LocaleIncomplete` nombrando las
      familias; con todo completo delega al caso de uso sin tocar el request.
- [ ] T053 [US4] `src/application/configuration/decorators/complete-locales.ts` y
      `src/domain/configuration/errors.ts` — el decorador (R-05) y `LocaleIncomplete`. Envuelve
      `UseCase<Request, Response>` y lee los idiomas de los dos requests por su forma.
- [ ] T054 [US4] `src/composition/modules/configuration.ts` — el decorador alrededor de las dos
      publicaciones (defaults y merchant), con el puerto enlazado a `messages`. Los dos casos de uso no
      cambian de forma.
- [ ] T055 [US4] `tests/integration/configuration/complete-locales.test.ts` — los cuatro escenarios de
      la spec: rechazo que nombra familias; completar por la API y aceptar; quitar un idioma se acepta; un
      arranque sobre un almacén con textos y niveles no juzga contra el release.
- [ ] T056 [US4] `npx vitest run tests/integration/levels.test.ts tests/integration/admin-configuration.test.ts
tests/integration/platform-level.test.ts` — la 036 con el decorador puesto, sin cambios de
      expectativa (SC-007).
- [ ] T057 [US4] `npm run test:mutation` acotado al diff de la historia.

**Checkpoint**: el hueco está cerrado donde se puede rechazar.

---

## Phase 6: User Story 5 — El historial de cada clave (P3)

**Goal**: listar las versiones de una clave y leer una, en las dos capas, con el alcance de la
publicación.

**Independent Test**: `tests/integration/messages/history.test.ts`.

- [ ] T058 [US5] `contracts/` — las cuatro lecturas pasan a `built`: `paths/admin-texts-versions.yaml`,
      `admin-texts-version.yaml`, `admin-merchant-texts-versions.yaml`, `admin-merchant-texts-version.yaml`,
      con `attributeValue` como parámetro de consulta, `x-collection` y paginación por `$ref`,
      `TextVersionPage`. `contract:check`, `contract:types`.
- [ ] T059 [US5] `tests/unit/application/messages/text-history.test.ts`,
      `src/application/messages/use-cases/list-text-versions.use-case.ts` y
      `src/application/messages/use-cases/get-text-version.use-case.ts` — más nueva primero, paginado,
      «quitado» incluido; una versión concreta inmutable; alcance: la base la lee cualquier operador, la
      del merchant exige alcance sobre él.
- [ ] T060 [P] [US5] `src/interface-adapters/messages/controllers/` — los cuatro controllers, con el
      presenter de T034 y el cursor por `boundary.ts`.
- [ ] T061 [US5] `src/composition/modules/messages.ts` — los cuatro handlers.
- [ ] T062 [US5] `tests/integration/messages/history.test.ts` — los tres escenarios de la spec.
- [ ] T063 [US5] `npm run test:mutation` acotado al diff de la historia.

**Checkpoint**: las cinco historias completas.

---

## Phase 7: Lo que queda dicho

- [ ] T064 `.specify/memory/constitution.md` — la enmienda de redacción a X por `/speckit-constitution`
      (PATCH): el merchant recibe el último texto publicado de cada clave y lo que se estampa es la
      versión del texto; «con qué voz» se retira. Con su línea en el registro de cambios de la
      constitución.
- [ ] T065 [P] `docs/adr/` — una enmienda a ADR-036 (vocabulario cerrado y mapa del merchant): el texto
      de un merchant es la tercera instancia del patrón, y la voz se retiró porque con una capa por
      merchant no nombraba nada. Cita esta spec como fuente.
- [ ] T066 [P] `docs/deudas.md` — **D-34, el tercero llegó**: el almacén de textos es el tercer historial
      numerado e inmutable con uno en vigor (merchant, nivel, texto). La condición de cierre se cumple:
      o se extrae lo común en las dos tecnologías en esta feature, o se deja escrito por qué no (la clave
      compuesta y «quitado» lo hacen distinto). La fila cambia de estado con la decisión. **Depende de
      que la 037 esté mergeada**, que es donde D-34 vive.
- [ ] T067 [P] Los READMEs que el cambio toca, con su inventario (ADR-032): `config/` (la semilla),
      `migrations/` (006), `tests/` (`durability/texts`), `contracts/` si una extensión nueva lo pide.
- [ ] T068 Correr el **quickstart** de punta a punta, los siete pasos y el uso desde afuera, y completar
      «Cambios respecto del plan» con fecha: la cifra de SC-006 al lado de la de la misma máquina sin la
      feature, con la mutación terminada antes de medir.
- [ ] T069 La cadena de cierre: `npm run contract:check`, `npm run test:all`, `npm run test:mutation`,
      `npm run build && npm run test:contract`, `npm run release-check`.

---

## Dependencies & Execution Order

### Entre fases

- **Fase 1** bloquea a las cinco historias: sin el almacén, la clave y la resolución por capas no hay
  nada que publicar ni que servir.
- **Fase 2 (US1)** antes que **3 (US2)**: el texto del merchant se resuelve contra una base que ya se
  publica por API, y el presenter y el servicio de alcance nacen en la 2.
- **Fase 4 (US3)** después de 2 y 3: prueba de punta a punta lo que las dos ya hacen por el servicio de
  alcance; no agrega código salvo presentación.
- **Fase 5 (US4)** es independiente de 2, 3 y 4: toca `configuration` y el puerto de completitud del
  almacén, que la fase 1 ya tiene. Puede ir en paralelo con la 2.
- **Fase 6 (US5)** después de 2 y 3: lee lo que ellas escriben.
- **Fase 7** espera a todas.

### Dentro de cada fase

- Toda prueba de regla (`T002`, `T004`, `T006`, `T010`, `T012`, `T030`, `T032`, `T040`, `T052`) va
  **antes** de su código y tiene que fallar primero.
- En cada historia con operación: mapa (hecho en T001) → contrato → `contract:check` → tipos → caso de
  uso → controller → composición → integración → mutación. El orden del contrato no se salta.
- T008 (retirar la voz) va después de T005 y antes de T016: lo que compila entre medio es la lista de
  sitios que la nombraban.
- T014 corre las pruebas de la 036 y tiene que quedar en verde antes de seguir: es la única tarea que
  cambia código de otra feature en la fase 1.

### Paralelismo

- T002, T004, T006 entre sí (tres pruebas del dominio).
- T009 con todo lo de la fase 1 después de T008.
- T034 con T032 y T033; T042 con T040 y T041; T060 con T059.
- La fase 5 entera con la fase 2.
- T065, T066, T067 entre sí, después de T064.

### Lo que este orden evita

- **Un contrato con operaciones que nadie sirve**: el arranque se niega, y por eso cada historia pasa las
  suyas a `built` cuando las sirve, no todas en la fase 1.
- **Un reinicio copiado en dos módulos**: T013 lo extrae antes de que la 038 lo necesite, y T014 prueba
  que la 036 no lo notó.
- **Un decorador puesto a medias**: T052 fija qué juzga antes de que T054 lo cablee, y T056 prueba que la
  036 responde lo mismo con él puesto.

---

## Implementation Strategy

### Lo mínimo entregable

Fases 1 y 2: un texto base se corrige desde la API y la intervención siguiente lo muestra, con su versión
en el registro. Es entregable y commiteable solo; las capas del merchant, la regla de congelamiento de
punta a punta, el idioma sin textos y el historial se suman después sin rehacer nada.

### Incremental

1. Fase 1 → `npm test`, durabilidad, la 036 en verde → commit del mecanismo.
2. Fase 2 → integración, mutación → commit de la historia 1.
3. Fases 3 y 5, en el orden que convenga → commit por historia.
4. Fase 4 → commit.
5. Fase 6 → commit.
6. Fase 7 → quickstart, cadena de cierre → commit de cierre.

### Notas

- Un commit por cambio, en español, conventional commits; nada se commitea con pruebas en rojo.
- La medición de SC-006 se hace con la mutación **terminada**: la 037 midió bajo carga y dio cifras
  falsas.
- Un mutante que sobrevive se trabaja con la skill `triaging-mutants`; nunca se cambia el dominio sólo
  para el gate.
- Si la 037 no está mergeada al llegar a la fase 1, la regla de registros planos (T005, T019) se aplica
  igual: está decidida y la 037 la fijó; T066 sí espera a su merge.
