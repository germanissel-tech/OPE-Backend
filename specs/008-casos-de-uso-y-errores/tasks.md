# Tasks: Casos de uso uniformes, servicios de aplicación y errores estandarizados

**Input**: Design documents from `specs/008-casos-de-uso-y-errores/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (sin `contracts/`:
la superficie HTTP no cambia)

**Tests**: la spec exige fixture por regla (FR-050), prueba de réplica (FR-024) y que la suite
001–007 pase sin cambiar aserciones (FR-052); las tareas de prueba están incluidas.

**Organization**: por historia de usuario; la fase fundacional trae los tipos que todas
necesitan (`UseCase`, `Result`, `DomainError`, errores por módulo, puertos con `Result`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1 forma del caso de uso · US2 servicios · US3 errores · US4 traducción HTTP ·
  US5 decoradores

## Path Conventions

Proyecto único: `src/`, `tests/`, `scripts/`, `docs/` en la raíz. Módulos de aplicación en
`src/application/<módulo>/{use-cases,services,ports}/`; errores en `src/domain/<módulo>/errors.ts`.

---

## Phase 1: Setup

- [ ] T001 Verificar el punto de partida: `npm run contract:check && npm run quality && npm test`
      en verde sobre `008-casos-de-uso-y-errores` y anotar en `specs/008-casos-de-uso-y-errores/quickstart.md`
      (sección histórica) la cantidad de pruebas de `npm test` como referencia de FR-052

---

## Phase 2: Foundational (bloquea todas las historias)

**Purpose**: la raíz de errores, el resultado, el contrato y los puertos con `Result`, sin
tocar aún los casos de uso (la suite sigue verde al cerrar la fase).

- [ ] T002 [P] Crear `src/domain/shared-kernel/errors.ts`: `SafeDetails = Readonly<Record<string,
string | number | boolean>>`, `ModuleName = "shared-kernel" | "system" | "merchant" | "ledger" |
"experiment" | "ingestion"`, `abstract class DomainError extends Error` con `abstract readonly
code: string`, `abstract readonly module: ModuleName`, `readonly details: SafeDetails` asignado
      en el constructor (sin parameter properties), `this.name = new.target.name`; exportar
      desde `src/domain/shared-kernel/index.ts`
- [ ] T003 [P] Crear `src/domain/shared-kernel/result.ts`: `Result<T, E extends DomainError> =
{ ok: true; value: T } | { ok: false; error: E }`, `ok<T>(value)`, `fail<E extends
DomainError>(error)`; exportar desde `src/domain/shared-kernel/index.ts`
- [ ] T004 [P] Crear `src/application/shared-kernel/use-case.ts` con `interface UseCase<Request,
Response> { execute(request: Request): Promise<Response> }`; exportar desde
      `src/application/shared-kernel/index.ts`
- [ ] T005 [P] Crear `src/domain/ledger/errors.ts`: `LedgerUnavailable` (`ledger-unavailable`),
      `ExposureDecisionUnknown` (`exposure-decision-unknown`), `ExposureOfNoOp`
      (`exposure-of-no-op`), todos `module = "ledger" as const`, mensajes iguales a los `detail`
      actuales de `src/application/ledger/confirm-exposure.ts`; `export type LedgerError = …`;
      exportar desde `src/domain/ledger/index.ts`
- [ ] T006 [P] Crear `src/domain/ingestion/errors.ts`: `SessionVisitorMismatch`
      (`session-visitor-mismatch`), `EventTimestampOutOfRange` (`event-timestamp-out-of-range`),
      `module = "ingestion" as const`, mensajes iguales a los `detail` actuales de
      `src/domain/ingestion/batch.ts`; `export type IngestionError = …`; exportar desde
      `src/domain/ingestion/index.ts`
- [ ] T007 [P] Crear `src/domain/merchant/errors.ts`: `Unauthorized` (`unauthorized`),
      `OriginNotAllowed` (`origin-not-allowed`), `module = "merchant" as const`; `export type
MerchantError = …`; exportar desde `src/domain/merchant/index.ts`
- [ ] T008 Cambiar `src/domain/ingestion/batch.ts`: `checkBatch` devuelve `Result<void,
IngestionError>` (con `fail(new SessionVisitorMismatch(...))` etc.) en lugar de `BatchCheck`;
      eliminar `BatchInvariant`/`BatchCheck` y adaptar `tests/unit/domain/**` que los usen sólo
      en la forma del resultado (`r.error.code`), no en las aserciones de negocio
- [ ] T009 Cambiar los puertos de escritura a `Result` (data-model.md): `record()` de
      `src/application/ledger/ports/decision-ledger.ts` y `src/application/experiment/ports/assignment-ledger.ts`
      → `Promise<Result<void, LedgerUnavailable>>`; `src/application/ledger/ports/exposure-ledger.ts`
      → `Promise<Result<ExposureRecordStatus, LedgerUnavailable>>` con `ExposureRecordStatus =
"recorded" | "already-recorded"`; eliminar `src/application/shared-kernel/ports/record-outcome.ts`
      y su export en `src/application/shared-kernel/index.ts`; añadir `ledger` a `experiment` en
      `CONTEXT_MAP` de `.dependency-cruiser.cjs`
- [ ] T010 Adaptar los gateways a `ok()`/`fail(new LedgerUnavailable(...))`:
      `src/interface-adapters/gateways/ledger/memory-decision-ledger.ts`,
      `src/interface-adapters/gateways/ledger/memory-exposure-ledger.ts`,
      `src/interface-adapters/gateways/experiment/memory-assignment-ledger.ts`, y los dobles de
      `tests/helpers/unavailable-ledgers.ts` (`unavailable*Ledger`, `flakyLedger`)
- [ ] T011 Adaptar provisionalmente los consumidores actuales de `RecordOutcome` para que la
      suite siga verde antes de migrar: `src/application/ingestion/ingest-batch.ts`
      (`recordOrDegrade`), `src/application/experiment/assign-visitor.ts`,
      `src/application/ledger/confirm-exposure.ts` leen `r.ok` / `r.error`; `npm test` en verde
- [ ] T012 [P] Crear `src/interface-adapters/http/to-problem.ts`: `toProblem(error: DomainError,
instance: string): { status: number; body: ProblemDetails; headers?: Record<string, string> }`
      con `type = urn:ope:problem:${code}`, `status`/`title` de `PROBLEM_TYPES[code]`, `detail =
error.message`, `instance`; `HEADERS_BY_CODE` en `src/interface-adapters/http/problem-details.ts`
      (`ledger-unavailable → { "retry-after": "5" }`); `code` fuera del catálogo → `throw new
Error` (error de programación)
- [ ] T013 [P] Pruebas de tipos en `tests/types/result.test-d.ts`: `Result<number, Error>` no
      compila (`@ts-expect-error`), `switch` sobre `error.code` de una unión sin un caso no
      compila, `error.module` estrecha a `ModuleName`
- [ ] T014 [P] Pruebas unitarias `tests/unit/domain/shared-kernel/errors.test.ts` y
      `result.test.ts`: `name` es el nombre de la clase, `details` por defecto `{}`, `instanceof
DomainError`, `ok`/`fail` producen la forma exacta
- [ ] T015 Commit `refactor(shared-kernel): raíz DomainError, Result, contrato UseCase y puertos
de escritura con Result (ADR-023)` con `npm run quality && npm test` en verde

**Checkpoint**: tipos listos; la suite pasa; ningún caso de uso migrado aún.

---

## Phase 3: User Story 1 — Todo caso de uso tiene la misma forma (Priority: P1) 🎯 MVP

**Goal**: los cuatro casos de uso servidos por HTTP son clases `*UseCase` con `execute` y
`*Dependencies`; controllers y composición los reciben por contrato; suite sin cambios de
aserciones.

**Independent Test**: `npx vitest run tests/unit tests/integration` verde; `npm run lint` falla
con `ope/use-case-shape` y `ope/dependencies-are-interfaces` sobre sus fixtures.

- [ ] T016 [P] [US1] Crear `src/application/system/use-cases/get-service-health.use-case.ts`:
      `interface GetServiceHealthDependencies { clock: Clock }`, `class GetServiceHealthUseCase
implements UseCase<void, ServiceHealth>`; eliminar `src/application/system/get-service-health.ts`;
      actualizar `src/application/system/index.ts`, `src/composition/modules/system.ts`,
      `src/interface-adapters/http/controllers/system/get-health.ts` (recibe `UseCase<void,
ServiceHealth>`), `tests/unit/health.test.ts` (sólo construcción del sujeto)
- [ ] T017 [P] [US1] Crear `src/application/merchant/use-cases/resolve-ingest-key.use-case.ts`:
      `ResolveIngestKeyRequest { key?: string; origin?: string }`, `ResolveIngestKeyDependencies {
merchants: MerchantDirectory }`, `class ResolveIngestKeyUseCase implements
UseCase<ResolveIngestKeyRequest, Result<Merchant, MerchantError>>`; eliminar
      `src/application/merchant/resolve-ingest-key.ts`; actualizar `src/application/merchant/index.ts`,
      `src/composition/modules/merchant.ts`, `src/interface-adapters/http/security/ingest-key.ts`
      (`await useCase.execute(...)`; `SecurityError` construido desde `result.error.code`)
- [ ] T018 [US1] Crear `src/application/ledger/use-cases/confirm-exposure.use-case.ts`:
      `ConfirmExposureRequest` (el input actual), `ConfirmExposureDependencies { decisions:
DecisionLedger; exposures: ExposureLedger }`, `class ConfirmExposureUseCase implements
UseCase<ConfirmExposureRequest, Result<ExposureRecordStatus, LedgerError>>`; eliminar
      `src/application/ledger/confirm-exposure.ts`; actualizar `src/application/ledger/index.ts`,
      `src/composition/modules/ledger.ts`, `src/interface-adapters/http/controllers/ledger/confirm-exposure.ts`
      (`r.ok ? 2xx : toProblem(r.error, instance)`, sin literales de tipo de problema),
      `tests/unit/application/ledger/confirm-exposure.test.ts` (sólo construcción del sujeto y
      `r.error.code`)
- [ ] T019 [US1] Crear `src/application/ingestion/use-cases/ingest-batch.use-case.ts`:
      `IngestBatchRequest` (el input actual), `IngestBatchDependencies { clock; ids; logger;
eventDedup; decisions; assignment: AssignmentService }` (6 campos; `AssignmentService` llega en
      T024 — hasta entonces el campo se tipa con la interfaz actual `AssignVisitor` y se renombra
      en T024), `class IngestBatchUseCase implements UseCase<IngestBatchRequest,
Result<IngestOutcome, IngestionError>>` conservando el orden `checkBatch → assign → dedup →
decideArm → noOp → record` y la degradación a `NO_OP ledger-unavailable` (ADR-021) cuando
      `assign()` o `decisions.record()` devuelven `LedgerUnavailable`; eliminar
      `src/application/ingestion/ingest-batch.ts`; actualizar `src/application/ingestion/index.ts`,
      `src/composition/modules/ingestion.ts`, `src/interface-adapters/http/controllers/ingestion/ingest-events.ts`
      (`toProblem` para el fallo)
- [ ] T020 [US1] `npm run quality && npm test && npm run test:contract` en verde; verificar con
      `git diff main -- tests/integration tests/contract-rules contracts | grep -c "^[-+]expect"`
      que las aserciones de integración no cambiaron (esperado 0)
- [ ] T021 [P] [US1] Regla ESLint tipada `scripts/lint/use-case-shape.mjs` (`ope/use-case-shape`,
      patrón de `scripts/lint/no-magic-strings.mjs`): en archivos `src/application/**/use-cases/*.ts`
      exactamente una clase exportada, nombre `*UseCase`, `implements UseCase<…>`, método
      `execute`, constructor con exactamente un parámetro cuyo tipo es una interfaz `*Dependencies`
      declarada en el mismo archivo; registrar en `eslint.config.mjs` (`files: ["src/application/**/use-cases/**"]`)
      y fixture `tests/lint/fixtures/as-src/use-case-shape.ts` + entrada en `expected` de
      `tests/lint/lint.test.ts` (la carpeta del fixture debe simular `use-cases/`: ajustar el
      mapeo de rutas de `as-src` si la regla mira la ruta)
- [ ] T022 [P] [US1] Regla ESLint tipada `scripts/lint/dependencies-are-interfaces.mjs`
      (`ope/dependencies-are-interfaces`): toda interfaz `*Dependencies` en `src/application/**`
      tiene ≤ `maxDependencies` (6, opción de la regla) miembros y cada miembro es de tipo
      interfaz (símbolo `Interface`) — no clase, no función, no `Ports`; fixture
      `tests/lint/fixtures/as-src/dependencies-are-interfaces.ts` (una clase concreta como campo y
      siete campos) + entrada en `expected`
- [ ] T023 [US1] Commit `refactor(application): casos de uso como clases UseCase con
dependencias por interfaz (ADR-023)` con `npm run quality && npm test` en verde

**Checkpoint**: US1 completa y verificable sola.

---

## Phase 4: User Story 2 — Un caso de uso nunca invoca a otro (Priority: P1)

**Goal**: la asignación es `AssignmentService`; dependency-cruiser prohíbe use-case → use-case y
service → use-case.

**Independent Test**: `npm run arch` falla sobre los fixtures de las dos reglas;
`tests/unit/application/experiment/assignment.service.test.ts` conserva las aserciones de la 007.

- [ ] T024 [US2] Crear `src/application/experiment/services/assignment.service.ts`: `interface
AssignmentService { assign(merchantId: MerchantId, visitorId: VisitorId): Promise<Result<Assignment
| undefined, LedgerUnavailable>> }`, `AssignmentServiceDependencies { experiments; assignments;
clock; logger }`, `class DefaultAssignmentService implements AssignmentService` con la lógica de
      `src/application/experiment/assign-visitor.ts` (idempotencia, drift logueado sin
      `visitorId`); eliminar `assign-visitor.ts`; actualizar `src/application/experiment/index.ts`,
      `src/composition/modules/experiment.ts` (bind `assignment: () => new
DefaultAssignmentService({...})`, quitar `assignVisitorOf`), `src/composition/modules/ingestion.ts`
      y el campo `assignment` de `IngestBatchDependencies`
- [ ] T025 [US2] Mover `tests/unit/application/experiment/assign-visitor.test.ts` a
      `tests/unit/application/experiment/assignment.service.test.ts` cambiando sólo la
      construcción del sujeto (`new DefaultAssignmentService({...})`) y la forma del resultado
      (`r.ok`, `r.value`, `r.error.code`); aserciones de negocio intactas
- [ ] T026 [P] [US2] Reglas en `.dependency-cruiser.cjs`: `use-cases-no-use-cases` (from
      `src/application/**/use-cases/`, to `src/application/**/use-cases/` distinto del propio
      archivo) y `services-no-use-cases` (from `src/application/**/services/`, to
      `src/application/**/use-cases/`); fixtures en `tests/architecture/fixtures/src/application/`
      (un caso de uso que importa otro; un servicio que importa un caso de uso) y sus entradas en
      `tests/architecture/architecture.test.ts`
- [ ] T027 [US2] Commit `refactor(experiment): AssignmentService como servicio de aplicación;
un caso de uso nunca invoca a otro (ADR-023)` con `npm run quality && npm test` en verde

**Checkpoint**: US1 + US2.

---

## Phase 5: User Story 3 — Errores de negocio tipados con raíz común (Priority: P1)

**Goal**: las reglas y la réplica hacen cumplir la jerarquía que la fase 2 introdujo.

**Independent Test**: fixtures de `ope/domain-error-shape`, `ope/no-throw-domain-error` y
`ope/no-generic-catch-in-application` fallan; la prueba de réplica pasa.

- [ ] T028 [P] [US3] Regla ESLint tipada `scripts/lint/domain-error-shape.mjs`
      (`ope/domain-error-shape`): en `src/domain/<m>/errors.ts` toda clase exportada extiende
      `DomainError`, declara `readonly code = "<slug>" as const` y `readonly module = "<m>" as
const` con `<m>` igual a la carpeta, y el archivo exporta al menos un `type` unión; fixture
      `tests/lint/fixtures/as-src/domain-error-shape.ts` (clase sin raíz; `module` de otro módulo) + entrada en `expected`
- [ ] T029 [P] [US3] Regla ESLint tipada `scripts/lint/no-throw-domain-error.mjs`
      (`ope/no-throw-domain-error`): en `src/domain/**` y `src/application/**`, `throw` cuyo tipo
      es asignable a `DomainError` falla; fixture `tests/lint/fixtures/as-src/no-throw-domain-error.ts` + entrada en `expected`
- [ ] T030 [P] [US3] Regla ESLint `scripts/lint/no-generic-catch-in-application.mjs`
      (`ope/no-generic-catch-in-application`): `TryStatement` con `handler` en
      `src/application/**` falla (los puertos no lanzan); fixture
      `tests/lint/fixtures/as-src/no-generic-catch-in-application.ts` + entrada en `expected`
- [ ] T031 [P] [US3] Prueba de réplica en `tests/unit/domain/error-codes.test.ts`: recorre
      `src/domain/**/errors.ts` (o instancia cada clase exportada), recoge `code`, verifica que
      son únicos y que cada uno existe en `contracts/problem-types.yaml` con `status` igual al de
      `PROBLEM_TYPES` (`src/interface-adapters/http/problem-details.ts`)
- [ ] T032 [US3] Prueba de aplicación en `tests/unit/application/ingestion/ingest-batch.use-case.test.ts`:
      lote con dos visitantes → `r.ok === false` y `r.error instanceof SessionVisitorMismatch`
      con `code` `session-visitor-mismatch` y `module` `ingestion`; ledger no disponible en
      `assign()` y en `decisions.record()` → `NO_OP ledger-unavailable` sin registrar (con
      `unavailableDecisionLedger` de `tests/helpers/unavailable-ledgers.ts`)
- [ ] T033 [US3] Commit `feat(lint): reglas de forma de errores de dominio y réplica de códigos
(ADR-023)` con `npm run quality && npm test` en verde

**Checkpoint**: US1–US3.

---

## Phase 6: User Story 4 — La traducción a HTTP es una sola función (Priority: P2)

**Goal**: `toProblem` es la única traducción; los controllers no tienen literales de tipo.

**Independent Test**: `tests/unit/http/to-problem.test.ts` verde; `npm run arch` falla sobre el
fixture de `problem-translation-only-in-http`; Schemathesis sin cambios.

- [ ] T034 [P] [US4] Pruebas `tests/unit/http/to-problem.test.ts`: para cada clase de
      `domain/**/errors.ts` el body tiene `type` `urn:ope:problem:<code>`, `status` y `title` del
      catálogo, `detail` = mensaje, `instance` dado; `LedgerUnavailable` → `503` y header
      `retry-after: 5`; `details` no aparece en el body; un `DomainError` con `code` fuera del
      catálogo lanza `Error`
- [ ] T035 [P] [US4] Regla `problem-translation-only-in-http` en `.dependency-cruiser.cjs`:
      sólo `src/interface-adapters/http/**` importa `src/interface-adapters/http/to-problem.ts`
      y `problem-details.ts`; fixture en `tests/architecture/fixtures/src/` (un gateway que
      importa `to-problem`) + entrada en `tests/architecture/architecture.test.ts`
- [ ] T036 [US4] Verificar que `src/interface-adapters/http/controllers/**` y
      `src/interface-adapters/http/security/ingest-key.ts` no contienen literales de slug de
      problema (`grep -rn "urn:ope:problem\|invariantResponse" src/interface-adapters/http/controllers`
      → 0); eliminar `invariantResponse` y `ledgerUnavailableResponse` de `problem-details.ts` si
      quedaron sin uso (dead-code en `npm run quality`)
- [ ] T037 [US4] Commit `refactor(http): toProblem como única traducción de errores de dominio
(ADR-023)` con `npm run quality && npm test && npm run test:contract` en verde

---

## Phase 7: User Story 5 — Decoradores transversales (Priority: P3)

**Goal**: `LoggedUseCase` envuelve los casos de uso servidos por HTTP desde la composición.

**Independent Test**: `tests/unit/application/shared-kernel/logged-use-case.test.ts` verde; el
log de una ingesta muestra `useCase`, `durationMs`, `outcome`.

- [ ] T038 [US5] Crear `src/application/shared-kernel/decorators/logged-use-case.ts`: `class
LoggedUseCase<I, O> implements UseCase<I, O>` con constructor `(name: string, inner: UseCase<I,
O>, deps: { clock: Clock; logger: Logger })`; `execute` mide con `clock.now()` y loguea `info`
      `{ useCase, durationMs, outcome }` donde `outcome = "ok"` si el response no es un `Result`
      fallido y `error.code` si lo es; nunca el request ni `details`; exportar desde
      `src/application/shared-kernel/index.ts`
- [ ] T039 [P] [US5] Pruebas `tests/unit/application/shared-kernel/logged-use-case.test.ts` con
      `recordingLogger` de `tests/helpers/unavailable-ledgers.ts` y reloj fijo: entrada con nombre,
      duración y `ok`; con `code` en fallo; response directo (sin `Result`) → `ok`; el registro no
      contiene `visitorId` ni el request serializado
- [ ] T040 [US5] Aplicar en composición: `src/composition/modules/{system,ingestion,ledger}.ts`
      envuelven `new LoggedUseCase("getServiceHealth" | "ingestBatch" | "confirmExposure", new
*UseCase({...}), { clock, logger })`; añadir `logger`/`clock` a los ports del módulo `system` si
      faltan; `tests/integration/server.test.ts` (o una prueba nueva) verifica la línea de log
      `useCase: "ingestBatch"` tras una ingesta
- [ ] T041 [US5] Commit `feat(application): decorador de registro operativo sobre el contrato
UseCase (ADR-023)` con `npm run quality && npm test` en verde

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T042 [P] `docs/adr/023-casos-de-uso-servicios-y-errores.md`: `estado: aceptada`; ajustar
      el texto si la implementación cambió algún detalle (nombres de reglas, límite)
- [ ] T043 [P] `CLAUDE.md`: sección "Cómo se escribe un caso de uso nuevo" (archivo en
      `use-cases/`, `*Dependencies`, `Result` con la unión de errores, error en
      `domain/<módulo>/errors.ts` + entrada en `contracts/problem-types.yaml`, controller con
      `toProblem`, `new` + `LoggedUseCase` en composición) y las reglas nuevas en la tabla de
      tipado/arquitectura; paso 4 del flujo actualizado (`use-cases/`, `services/`)
- [ ] T044 [P] `README.md`: párrafo de la capa de aplicación (contrato, servicios, errores) si el
      README describe la arquitectura
- [ ] T045 `npm run test:mutation` sobre el diff y matar los mutantes supervivientes con
      aserciones (no con excepciones)
- [ ] T046 `specs/008-casos-de-uso-y-errores/quickstart.md`: completar "Estado al cierre" con
      fecha y salida de `npm test`, `npm run quality`, `npm run test:mutation`
- [ ] T047 Commit `chore(008): ADR-023 aceptada, guía de agentes y cierre de la feature`; `npm
run release-check` en verde; PR a `main` con CI verde y merge

---

## Dependencies & Execution Order

- **Phase 2** bloquea todo: T002–T004 en paralelo → T005–T007 en paralelo (dependen de T002) →
  T008 → T009 → T010 → T011 → T012–T014 en paralelo → T015.
- **US1 (Phase 3)**: T016–T017 en paralelo; T018 y T019 después (usan `toProblem`, T012);
  T020; T021–T022 en paralelo; T023.
- **US2 (Phase 4)**: T024 depende de T019; T025 depende de T024; T026 en paralelo con T024.
- **US3 (Phase 5)**: T028–T031 en paralelo desde el cierre de Phase 2; T032 depende de T019 y T024.
- **US4 (Phase 6)**: T034–T035 en paralelo desde Phase 2; T036 depende de T018–T019.
- **US5 (Phase 7)**: T038 desde Phase 2; T040 depende de T016–T019.
- **Polish**: depende de todo lo anterior.

## Parallel Example: Phase 2

```bash
Task: "Crear src/domain/shared-kernel/errors.ts"          # T002
Task: "Crear src/domain/shared-kernel/result.ts"          # T003
Task: "Crear src/application/shared-kernel/use-case.ts"   # T004
# luego
Task: "Crear src/domain/ledger/errors.ts"                 # T005
Task: "Crear src/domain/ingestion/errors.ts"              # T006
Task: "Crear src/domain/merchant/errors.ts"               # T007
```

## Implementation Strategy

1. **MVP = Phase 2 + US1**: con los tipos y los cuatro casos de uso migrados la suite pasa y las
   dos reglas de forma existen. Validar con `npm test` y el `grep` de FR-052.
2. US2 (servicio + reglas de arquitectura) y US3 (reglas de errores + réplica) cierran el
   "verificado por herramienta".
3. US4 y US5 son el beneficio visible; US5 se puede diferir sin dejar nada roto.
4. Un commit por fase, siempre con `npm run quality && npm test` en verde.

## Notes

- Ninguna tarea toca `contracts/`: si `contract:diff` reporta un cambio, algo salió del alcance.
- Las pruebas existentes cambian sólo en la construcción del sujeto y en la forma del resultado
  (`r.error.code` en vez de `r.invariant`/`r.reason`), nunca en lo que afirman (FR-052).
- `new XError(...)` dentro de dominio y aplicación no viola `new-only-in-composition`: esa regla
  sólo mira clases importadas de npm.
