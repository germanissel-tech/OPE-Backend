# Tasks: Asignación experimental y ledger

**Input**: Design documents from `specs/007-asignacion-experimental/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: exigidas por la spec (FR-032, FR-050, FR-052, FR-053, SC-001..SC-006). Pruebas
antes del código que las hace pasar; las propiedades de la asignación con nombre explícito
(determinismo, estabilidad, reparto, independencia, idempotencia). Código, comentarios y
contrato en inglés (ADR-015).

**Organization**: por historia, en el orden de commits del plan: (1) contrato + catálogos +
glosario + ADRs; (2) semántica de escritura del ledger (US4); (3) módulo `experiment`,
asignación en la ingesta, aislamiento y latencia por brazo (US1–US3); (4) prueba de carga,
guía y cierre (US5).

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Proyecto único, raíz `backend/`. Módulos en `src/<anillo>/<módulo>/` con `index.ts`;
composición en `src/composition/modules/<módulo>.ts`; pruebas en `tests/unit/<anillo>/<módulo>/`
y `tests/integration/`.

---

## Phase 1: Setup — contrato, catálogos, glosario, ADRs (commit 1)

- [x] T001 Copiar `specs/007-asignacion-experimental/contracts/components/responses/ServiceUnavailable.yaml` a `contracts/components/responses/` y agregar `"503": { $ref: ../components/responses/ServiceUnavailable.yaml }` a `contracts/paths/exposures.yaml` con la frase de `paths/exposures.additions.md` en la descripción; el mapa no cambia (`confirmExposure` sigue `built`).
- [x] T002 [P] Agregar a `contracts/problem-types.yaml` el tipo `ledger-unavailable` (503) y replicarlo en `src/interface-adapters/http/problem-details.ts`; agregar a `contracts/no-op-reasons.yaml` los motivos `control-arm`, `no-active-experiment`, `ledger-unavailable` (de `no-op-reasons.additions.yaml`) y replicarlos en `src/domain/ingestion/no-op-reasons.ts` (`NO_OP_REASONS`); `tests/unit/no-op-reasons.test.ts` y `tests/unit/problem-details.test.ts` siguen verificando la réplica.
- [x] T003 [P] Glosario (research R-07; `uso: disponible`; fuentes `mvp:01-arquitectura-mvp.md#0.1`, `#4.1`, `#5.1`, `#14.2`): `docs/dominio/experimento.md` (`experiment`), `asignacion.md` (`assignment`), `brazo.md` (`arm`), `grupo-de-control.md` (`control`), `grupo-de-tratamiento.md` (`treatment`), `intencion-de-tratar.md` (`intention-to-treat`); en `brazo.md`, la explicación de qué es un brazo (grupo de un experimento; CONTROL nunca recibe intervención; TREATMENT puede).
- [x] T004 [P] ADRs a `estado: aceptada`: `docs/adr/021-semantica-de-escritura-del-ledger.md`, `docs/adr/022-asignacion-experimental.md`.
- [x] T005 `npm run contract:check` (lint, bundle, `contract:diff` compatible, tipos regenerados con `npm run contract:types`, `check:api-map` sin cambios) y `npm test` en verde. Commit `feat(contrato): 503 ledger-unavailable en confirmExposure, motivos de asignación y ADR-021/022`.

---

## Phase 2: User Story 4 — El ledger escribe sin frenar la decisión y, si no está, el sistema se calla (Priority: P2, va primero: los puertos cambian de firma) (commit 2)

**Goal**: todo `record()` devuelve `accepted | unavailable`; ingesta → `NO_OP` `ledger-unavailable` sin registros; exposición → `503` con `Retry-After`; recuperación.

**Independent Test**: `tests/integration/ledger-unavailable.test.ts` en verde con ledgers falsos inyectados por override; suite anterior sin cambios de aserciones.

### Tests

- [x] T006 [P] [US4] Crear `tests/helpers/unavailable-ledgers.ts`: `unavailableDecisionLedger()`, `unavailableExposureLedger()`, `unavailableAssignmentLedger()` (todo `record` → `"unavailable"`, `find` → `undefined`) y `flakyLedger(inner, { unavailable: () => boolean })` que delega o reporta no disponible según un interruptor (para la recuperación).
- [x] T007 [P] [US4] Crear `tests/integration/ledger-unavailable.test.ts`: (a) `startTestApp({ ports: { decisions: unavailableDecisionLedger() } })` + lote válido → `202`, `decision.reason === "ledger-unavailable"`, `outcome NO_OP`, `ports.decisions.find` no lo tiene, sin 5xx, y el log operativo contiene `ledger-unavailable`; (b) exposición con `exposures` no disponible (decisión `INTERVENE` inyectada) → `503`, `content-type` Problem Details, `type urn:ope:problem:ledger-unavailable`, header `retry-after` numérico, `ports.exposures.find` vacío; (c) con `flakyLedger` que vuelve a estar disponible, el mismo lote produce una decisión registrada y la misma exposición `201`; (d) el tiempo de respuesta de la ingesta no incluye una espera del ledger: un ledger falso cuyo `record` resuelve tras 200 ms no debe retrasar la respuesta más de 50 ms **(decidir en implementación: si la aceptación es síncrona en memoria, este caso documenta la semántica con un ledger que acepta de inmediato y completa la escritura después; si no aplica, dejarlo como prueba de la interfaz `RecordOutcome`)**.
- [x] T008 [P] [US4] Ampliar `tests/unit/application/ledger/confirm-exposure.test.ts`: `exposureLedger.record → "unavailable"` ⇒ resultado `{ ok: false, unavailable: true }` (sin invariante) y ninguna exposición registrada.

### Implementation

- [x] T009 [US4] Crear `src/application/shared-kernel/ports/record-outcome.ts` (`export type RecordOutcome = "accepted" | "unavailable"`) exportado por `src/application/shared-kernel/index.ts`; cambiar `src/application/ledger/ports/decision-ledger.ts` (`record → Promise<RecordOutcome> | RecordOutcome`) y `exposure-ledger.ts` (`ExposureRecordStatus = "recorded" | "already-recorded" | "unavailable"`); gateways en memoria devuelven `"accepted"`/lo existente.
- [x] T010 [US4] `src/application/ledger/confirm-exposure.ts`: `record → "unavailable"` ⇒ `{ ok: false, unavailable: true }` (tipo `ConfirmExposureResult` ampliado); `src/interface-adapters/http/controllers/ledger/confirm-exposure.ts`: ese caso → `503` con `problem("ledger-unavailable")` y `headers: { "retry-after": "5" }` (constante con nombre, `LEDGER_RETRY_AFTER_SECONDS`).
- [x] T011 [US4] `src/application/ingestion/ingest-batch.ts`: `decisions.record` → `"unavailable"` ⇒ la decisión devuelta es `noOp({ …, reason: "ledger-unavailable" })` marcada como no registrada (`IngestOutcome.recorded: boolean` o equivalente) y el caso de uso lo informa por el `Logger` (`ledger-unavailable`, con `merchantId` y `decisionId`, nunca `visitorId`); el controller no cambia (202).
- [x] T012 [US4] `npm test`, `npm run arch`, `npm run quality` en verde; commit `feat(ledger): resultado de escritura explícito y degradación fail-closed (ADR-021)`.

---

## Phase 3: User Story 1 — Cada visitante cae siempre en el mismo brazo (Priority: P1) (commit 3, parte a)

**Goal**: módulo `experiment` en el dominio con `assignArm` pura y experimentos por configuración validados.

**Independent Test**: `tests/unit/domain/experiment/assignment.test.ts` y `tests/unit/composition/config.test.ts` en verde.

### Tests

- [x] T013 [P] [US1] Crear `tests/unit/domain/experiment/assignment.test.ts`: "determinism: the same input gives the same arm a thousand times"; "split: 100 000 distinct visitors land within ±1 pp of 50 %, 20 % and 80 %" (ids `vis_<n>` secuenciales, el caso adversario de research R-01); "independence: the same visitor in two merchants agrees ~50 % of the time (45–55 %)"; "edges: 0 % never TREATMENT, 100 % always TREATMENT"; "stability: seed and experimentId change the arm distribution independently (a different seed reshuffles ~50 %)"; `activeExperiment(experiments)` devuelve el `active` y `undefined` sin ninguno; `fnv1a32("")` y valores conocidos (`fnv1a32("a") === 0xe40c292c`).
- [x] T014 [P] [US1] Ampliar `tests/unit/composition/config.test.ts`: `experiments` opcional; `treatmentPercent` por defecto 50; dos `active` para el mismo merchant → `ConfigError`; `treatmentPercent` 101 / -1 / no entero, `seed` vacío, `experimentId` fuera del patrón, `status` desconocido, `startedAt` inválido → `ConfigError` nombrando `merchants[i].experiments[j].<campo>`.

### Implementation

- [x] T015 [US1] Crear `src/domain/shared-kernel/ids.ts` + `index.ts`: `ExperimentId` marcado y `asExperimentId`.
- [x] T016 [US1] Crear `src/domain/experiment/experiment.ts` (`Arm = "CONTROL" | "TREATMENT"`, `ExperimentStatus`, `Experiment { experimentId, merchantId, treatmentPercent, seed, status, startedAt }`, `activeExperiment(experiments: readonly Experiment[]): Experiment | undefined`), `src/domain/experiment/assignment.ts` (`fnv1a32(text): number` puro; `ASSIGNMENT_KEY_SEPARATOR = ""`; `assignArm(experiment, visitorId): Arm` = `fnv1a32(key) % 100 < treatmentPercent ? TREATMENT : CONTROL`; `Assignment { merchantId, experimentId, visitorId, arm, assignedAt }`), `src/domain/experiment/index.ts`; `.dependency-cruiser.cjs`: `experiment: ["shared-kernel"]`, `ingestion: [..., "experiment"]`.
- [x] T017 [US1] `src/composition/config.ts`: `ExperimentConfig { experimentId; treatmentPercent?; seed; status; startedAt }` y `MerchantConfig.experiments?: ExperimentConfig[]`; `parseMerchants` valida cada experimento (`ConfigError` con la ruta del campo) y que haya como máximo un `active` por merchant; `treatmentPercent` por defecto `DEFAULT_TREATMENT_PERCENT = 50`.

---

## Phase 4: User Story 2 — La asignación queda registrada cuando ocurre, una sola vez (Priority: P1) (commit 3, parte b)

**Goal**: `AssignmentLedger` (memoria) y caso de uso `assignVisitor` idempotente, con directorio de experimentos desde configuración.

**Independent Test**: `tests/unit/application/experiment/assign-visitor.test.ts` y `tests/unit/gateways/memory-assignment-ledger.test.ts` en verde.

### Tests

- [x] T018 [P] [US2] Crear `tests/unit/gateways/memory-assignment-ledger.test.ts`: `record` → `"accepted"`; `find` por (merchant, experimento, visitante); `record` de una existente conserva la primera (brazo y `assignedAt`) y devuelve `"accepted"` (idempotencia); otro merchant o otro experimento no la ven.
- [x] T019 [P] [US2] Crear `tests/unit/application/experiment/assign-visitor.test.ts` con directorio y ledger falsos: sin experimento activo → `{ ok: true, assignment: undefined }` sin `record`; primera vez → `record` con brazo = `assignArm` y `assignedAt = now`; segunda vez → devuelve la registrada sin `record`; ledger `"unavailable"` → `{ ok: false, reason: "ledger-unavailable" }`; brazo registrado distinto del calculado → devuelve el registrado y loguea `assignment-drift` con `merchantId` y `experimentId` (nunca `visitorId`).

### Implementation

- [x] T020 [US2] Crear `src/application/experiment/ports/experiment-directory.ts` (`ExperimentDirectory { activeFor(merchantId): Experiment | undefined }`), `ports/assignment-ledger.ts` (`AssignmentLedger { record(assignment): Promise<RecordOutcome> | RecordOutcome; find(merchantId, experimentId, visitorId): Promise<Assignment | undefined> | Assignment | undefined }`), `assign-visitor.ts` (`makeAssignVisitor({ experiments, assignments, clock, logger })` → `AssignVisitor`; resultado `{ ok: true; assignment?: Assignment } | { ok: false; reason: "ledger-unavailable" }`), `index.ts`.
- [x] T021 [US2] Crear `src/interface-adapters/gateways/experiment/config-experiment-directory.ts` (de `MerchantConfig[]`, con `asExperimentId`/`asMerchantId` y `Date` de `startedAt`) y `memory-assignment-ledger.ts` (`Map` con clave `merchant/experiment/visitor`).

---

## Phase 5: User Story 3 — CONTROL recorre el mismo camino y siempre resuelve no intervenir (Priority: P1) (commit 3, parte c)

**Goal**: la ingesta asigna antes de decidir; la decisión registra brazo y experimento; CONTROL → `control-arm`; el brazo no viaja.

**Independent Test**: `tests/integration/assignment.test.ts` en verde; `isolation` y `ingest-latency` ampliadas en verde.

### Tests

- [x] T022 [P] [US3] Crear `tests/integration/assignment.test.ts` (merchant A con experimento activo `exp_a_00001`, seed fija; visitantes elegidos con `assignArm` en la prueba para tener uno por brazo; merchant B sin experimentos): primer lote → una asignación en `ports.assignments` con los cinco campos y `assignedAt` del reloj fijo; diez lotes más → sigue una y el brazo no cambia; lote rechazado (422 y 400) → sin asignación; CONTROL → `202` `reason control-arm` y decisión con `experiment.arm CONTROL`; TREATMENT → `reason decision-plane-unavailable` y `experiment.arm TREATMENT`; B (sin experimento) → `reason no-active-experiment` y sin asignación; **ninguna respuesta** de ingesta ni de exposición contiene `"arm"`, `"experimentId"`, `CONTROL` ni `TREATMENT` como campo (el único rastro admitido es `reason`); exposición de una decisión CONTROL → `422 exposure-of-no-op`.
- [x] T023 [P] [US3] Ampliar `tests/integration/isolation.test.ts`: mismo visitante en A (experimento activo) y en un merchant C con experimento activo de otra seed → asignaciones independientes y `find` cruzado `undefined`; experimento cerrado + activo en A → asignación nueva en el activo, la del cerrado intacta (inyectada por el puerto).
- [x] T024 [P] [US3] Ampliar `tests/integration/ingest-latency.test.ts`: p95 por brazo con dos visitantes fijos; aserción `max(p95) / min(p95) < 3` y el umbral de 50 ms; imprime ambos.

### Implementation

- [x] T025 [US3] `src/domain/ledger/decision.ts`: `experiment?: { experimentId: ExperimentId; arm: Arm }` (import del tipo desde `../experiment/index.js` — **verificar el mapa de contextos**: `ledger` no depende de `experiment`; si el tipo `Arm` tiene que cruzar, moverlo a `shared-kernel` como `Arm` de dominio, o definir en `ledger` el par `{ experimentId: string; arm: "CONTROL" | "TREATMENT" }` con los tipos marcados de `shared-kernel`. Decisión: `Arm` y `ExperimentId` en `shared-kernel`, `Experiment`/`assignArm` en `experiment`).
- [x] T026 [US3] `src/domain/ingestion/decide.ts`: `decideArm(arm: Arm | undefined, batch): NoOpReason` (`undefined` → `no-active-experiment`; `CONTROL` → `control-arm`; `TREATMENT` → `decide(batch)`); exportar por `index.ts`.
- [x] T027 [US3] `src/application/ingestion/ingest-batch.ts`: deps + `assignVisitor`; orden `checkBatch → assignVisitor → claim → decideArm → noOp({ …, experiment }) → decisions.record`; `assignVisitor` no disponible ⇒ decisión `NO_OP ledger-unavailable` sin registrar (reutiliza el camino de T011). `src/interface-adapters/http/controllers/ingestion/ingest-events.ts`: `toDecisionDto` no copia `experiment` (prueba de tipos: el DTO generado no tiene el campo).
- [x] T028 [US3] Composición: `src/composition/modules/experiment.ts` (`ExperimentPorts { experiments: ExperimentDirectory; assignments: AssignmentLedger }`, `configExperimentPorts(merchants)`, `memoryAssignmentPorts`, `experimentModule` sin handlers), `modules/ingestion.ts` (`IngestionPorts` gana `experiments`, `assignments`, `logger`; `ingestionModule` construye `makeAssignVisitor` y lo pasa a `makeIngestBatch`), `ports.ts` (`& ExperimentPorts`), `profiles/local.ts` (bind del módulo `experiment`), `modules/index.ts` si lista los módulos.
- [x] T029 [US3] `npm run arch` (mapa con `experiment`), `npm test`, `npm run quality`, `npm run test:contract` en verde; commit `feat(experiment): asignación determinista por visitante, registro ASSIGNED y CONTROL en NO_OP (ADR-022)`.

---

## Phase 6: User Story 5 — Sabemos cuánta carga aguanta una instancia hoy (Priority: P3) (commit 4, parte a)

**Goal**: `npm run test:load` informativo con autocannon.

**Independent Test**: el comando corre, imprime la línea `load: …` y termina en 0.

- [x] T030 [US5] `npm i -D autocannon@^8`; extraer de `scripts/test-contract.mjs` el arranque del servidor construido y la espera de salud a `scripts/server-lib.mjs` (`startBuiltServer({ env, port? }) → { base, stop() }`, `waitForHealth(url, timeoutMs)`) con JSDoc; `test-contract.mjs` la usa (sin cambio de comportamiento: `npm run test:contract` en verde).
- [x] T031 [US5] Crear `scripts/load-test.mjs`: arranca el servidor con `OPE_MERCHANTS` de prueba (merchant con experimento activo 50 %), corre autocannon (`connections` = `OPE_LOAD_CONNECTIONS` ?? 20, `duration` = `OPE_LOAD_DURATION` ?? 30, `setupRequest` que arma un lote de 20 eventos con `eventId` únicos y `visitorId` rotando entre `OPE_LOAD_VISITORS` ?? 1000, header `X-OPE-Ingest-Key`), imprime `load: <req/s> batches/s, p50 <ms>, p95 <ms>, p99 <ms>, errors <n>, non2xx <n> (<s> s, <c> connections)` y termina en 0; `package.json`: `"test:load": "node scripts/load-test.mjs"`; `tests/unit/scripts/load-test.test.ts` opcional: sólo que el script parsea y expone la línea de salida con `OPE_LOAD_DURATION=1` (marcar con presupuesto propio; si supera 10 s en CI, dejarlo fuera de `npm test`).
- [x] T032 [US5] Correr `npm run build && npm run test:load` y registrar las cifras (máquina, fecha, parámetros) en `specs/007-asignacion-experimental/quickstart.md`.

---

## Phase 7: Polish — guía, README y cierre (commit 4, parte b)

- [x] T033 [P] Actualizar `CLAUDE.md`: módulo `experiment` en la lista de módulos y en el mapa; sección "Composición" (`experiments` en `OPE_MERCHANTS`); notas del contrato: `RecordOutcome` y la regla de degradación (ADR-021), `503` sólo en exposición, brazo nunca como campo (ADR-022); comandos: `test:load`.
- [x] T034 [P] Actualizar `README.md` (configurar un experimento en `OPE_MERCHANTS`; `npm run test:load`) y `tests/contract/README.md` si el servidor de Schemathesis necesita el experimento (no: sin experimento decide `no-active-experiment`).
- [x] T035 Verificación final `npm run contract:check && npm run quality && npm test && npm run test:contract && npm run release-check && npm run test:mutation`; quickstart con tabla de estado fechada (BUILT / TESTED por historia, p95 por brazo, cifras de carga); marcar `[x]` todas las tareas. Commit `chore(007): prueba de carga, guía de agentes y cierre de la feature`.

---

## Dependencies

- Phase 1 → US4 (cambia firmas de puertos que US2 reutiliza) → US1 → US2 → US3 → US5 → Polish.
- T025 (tipos `Arm`/`ExperimentId` en `shared-kernel`) antes de T016 si se sigue la decisión indicada: mover T025 al inicio de la Phase 3 en la implementación.

## Parallel Execution Examples

- Phase 1: T002, T003, T004 en paralelo tras T001.
- US4: T006–T008 en paralelo; T009 → T010, T011 → T012.
- US1/US2: T013, T014, T018, T019 en paralelo; T015 → T016 → T017 → T020 → T021.
- US3: T022–T024 en paralelo; T026 → T027 → T028 → T029.
- Polish: T033, T034 en paralelo; T035 al final.

## Implementation Strategy

MVP = Phase 1 + US4 + US1–US3 (tres commits): con eso el experimento existe y se registra.
US5 y el cierre son un cuarto commit. Cada commit con `contract:check`, `quality`, `test` y
`test:contract` en verde.
