# Implementation Plan: Casos de uso uniformes, servicios de aplicación y errores estandarizados

**Branch**: `008-casos-de-uso-y-errores` | **Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-casos-de-uso-y-errores/spec.md`

## Summary

Refactor de la capa de aplicación sin cambio de comportamiento: un contrato común
`UseCase<Request, Response>` con `execute`, clases `*UseCase` (una por archivo, en
`use-cases/` de su módulo) que reciben un único objeto `*Dependencies` de interfaces (≤ 6
campos), servicios de aplicación (`*Service`) para lo compartido (la asignación de la 007 pasa
a `AssignmentService`), errores de negocio como clases que extienden una raíz `DomainError`
(`code`, `module`, `details`) definidas en `domain/<módulo>/errors.ts`, `Result<T, E extends
DomainError>` devuelto y nunca lanzado, una única `toProblem` en el adaptador HTTP y un
decorador de registro aplicado en composición. Todo verificado por reglas ESLint tipadas y
dependency-cruiser con fixture (ADR-023). Evidencia en [research.md](research.md).

## Technical Context

**Language/Version**: Node.js 22, TypeScript 7 / API 6 para herramientas (sin cambio)

**Primary Dependencies**: las existentes; ninguna nueva (el `Result` es propio, R-01)

**Storage**: sin cambio (memoria detrás de puertos); los puertos de escritura devuelven
`Result<…, LedgerUnavailable>` en lugar de `RecordOutcome`

**Testing**: Vitest (unitarias existentes adaptadas en la construcción del sujeto; nuevas para
`DomainError`/`Result`, `toProblem`, decorador, réplica de códigos), `tests/lint` (fixture por
regla ESLint nueva), `tests/architecture` (fixture por regla de dependency-cruiser nueva),
integración y Schemathesis **sin cambios**, `test:mutation` sobre el diff

**Target Platform**: sin cambio

**Project Type**: web-service (backend HTTP contract-first)

**Performance Goals**: SC de la 004/007 se mantienen (p95 de ingesta ≤ 50 ms en
`ingest-latency.test.ts`); el decorador de registro no añade I/O al camino crítico (un log por
ejecución, que ya existía como log de request)

**Constraints**: contrato HTTP y mapa sin cambios (FR-031); `erasableSyntaxOnly` (sin
parameter properties: campos declarados y asignados en el constructor); el dominio no importa
el catálogo del adaptador (la réplica se prueba, no se importa); `new` sólo en composición
(regla existente) y en `fail(new XError(...))` dentro de dominio/aplicación (los errores son
valores, no servicios: la regla de composición se acota a clases que no extienden
`DomainError`)

**Scale/Scope**: 5 casos de uso migrados, 1 servicio nuevo, 3 archivos de errores
(`ingestion`, `ledger`, `merchant`), 3 tipos del shared-kernel (`UseCase`, `Result`,
`DomainError`), 1 decorador, 1 `toProblem`, 5 reglas ESLint + 3 reglas de dependency-cruiser
con fixtures, 1 ADR, guía de agentes

## Constitution Check

| Gate                                          | ¿Aplica? | Cómo se cumple                                                                                                                                                                                        |
| --------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Superficie HTTP → contrato primero            | No       | Ninguna operación, respuesta ni schema cambia (FR-031); `contract:check` debe reportar "No incompatible changes" con el bundle idéntico; Schemathesis sin cambios                                     |
| Persistencia / API → aislamiento por merchant | No       | No se toca persistencia ni API; `isolation.test.ts` sigue pasando sin cambios (FR-052)                                                                                                                |
| Plano de decisión / ledger / campos / LLM     | **Sí**   | El orquestador (`IngestBatchUseCase`) sigue invocando a las autoridades en orden y a la vista (constitución II); la degradación fail-closed de ADR-021 se conserva como manejo de `LedgerUnavailable` |
| `x-invariants`                                | No       | Los slugs de invariantes existentes pasan a ser `code` de clases; las pruebas `[invariant:<slug>]` no cambian                                                                                         |
| Sustantivo nuevo en el contrato (glosario)    | No       | El contrato no cambia                                                                                                                                                                                 |
| Toca `src/` → dirección de dependencias       | **Sí**   | Tres reglas nuevas en `.dependency-cruiser.cjs` (R-03) con fixture; mapa de contextos: `experiment` gana `ledger` (por `LedgerUnavailable`); `npm run arch` en 0                                      |
| Privacidad (V, VII)                           | **Sí**   | `details` de `DomainError` es `SafeDetails` sin `visitorId`/`sessionId`; el decorador registra nombre, duración y código, nunca el request (prueba con `recordingLogger`)                             |
| Calidad verificada por herramienta (ADR-016)  | **Sí**   | Cada regla nueva tiene fixture que la viola (FR-050, SC-002); `quality`, `test:mutation` y `release-check` en verde (SC-006)                                                                          |

**Resultado pre-Phase 0**: PASA. **Post-Phase 1**: PASA.

## Project Structure

### Documentation (this feature)

```text
specs/008-casos-de-uso-y-errores/
├── plan.md, spec.md, research.md, data-model.md, quickstart.md
├── checklists/requirements.md
└── tasks.md
```

Sin `contracts/`: la feature no toca la superficie HTTP.

### Source Code (repository root)

```text
src/
├── domain/shared-kernel/errors.ts                DomainError (abstracta), SafeDetails, ModuleName
├── domain/shared-kernel/result.ts                Result<T, E extends DomainError>, ok(), fail()
├── domain/ingestion/errors.ts                    SessionVisitorMismatch, EventTimestampOutOfRange, … (invariantes del lote) + IngestionError
├── domain/ledger/errors.ts                       LedgerUnavailable, ExposureDecisionUnknown, ExposureOfNoOp + LedgerError
├── domain/merchant/errors.ts                     Unauthorized, OriginNotAllowed + MerchantError
├── application/shared-kernel/use-case.ts         UseCase<Request, Response>
├── application/shared-kernel/decorators/logged-use-case.ts   LoggedUseCase<I, O>
├── application/shared-kernel/ports/record-outcome.ts         ELIMINADO (sustituido por Result<void, LedgerUnavailable>)
├── application/system/use-cases/get-service-health.use-case.ts
├── application/merchant/use-cases/resolve-ingest-key.use-case.ts
├── application/experiment/services/assignment.service.ts     AssignmentService (interfaz) + DefaultAssignmentService
├── application/ingestion/use-cases/ingest-batch.use-case.ts  IngestBatchUseCase (deps: clock, ids, logger, eventDedup, decisions, assignment)
├── application/ledger/use-cases/confirm-exposure.use-case.ts
├── application/{ledger,experiment}/ports/*.ts    record() → Result<void | ExposureRecordStatus, LedgerUnavailable>
├── interface-adapters/http/to-problem.ts         toProblem(error, instance) → { status, body, headers? }
├── interface-adapters/http/problem-details.ts    catálogo (sin cambio) + HEADERS_BY_CODE
├── interface-adapters/http/controllers/**        usan execute() y toProblem()
├── interface-adapters/http/security/**           ResolveIngestKeyUseCase por contrato
├── interface-adapters/gateways/**                devuelven ok()/fail(new LedgerUnavailable())
└── composition/modules/*.ts                      new *UseCase({ … }) envuelto en LoggedUseCase; DefaultAssignmentService
scripts/lint/{use-case-shape,dependencies-are-interfaces,domain-error-shape,no-throw-domain-error,no-generic-catch-in-application}.mjs
eslint.config.mjs                                  registra las cinco reglas ope/*
.dependency-cruiser.cjs                            use-cases-no-use-cases, services-no-use-cases, problem-translation-only-in-http; CONTEXT_MAP experiment += ledger
docs/adr/023-casos-de-uso-servicios-y-errores.md
CLAUDE.md                                          "Cómo se escribe un caso de uso nuevo"
tests/
├── lint/fixtures/as-src/{use-case-shape,dependencies-are-interfaces,domain-error-shape,no-throw-domain-error,no-generic-catch-in-application}.ts
├── architecture/fixtures/src/**                   casos que violan las tres reglas nuevas
├── unit/domain/shared-kernel/{errors,result}.test.ts
├── unit/http/to-problem.test.ts                   + réplica de códigos contra problem-types.yaml
├── unit/application/shared-kernel/logged-use-case.test.ts
├── unit/application/experiment/assignment.service.test.ts   (de assign-visitor.test.ts, mismas aserciones)
├── unit/application/**/*.test.ts                  construcción del sujeto con new; r.error.code
└── helpers/unavailable-ledgers.ts                 devuelven fail(new LedgerUnavailable())
```

**Structure Decision**: dentro de cada módulo de aplicación aparecen dos carpetas nuevas,
`use-cases/` y `services/`, al lado de `ports/`; el `index.ts` del módulo sigue siendo la única
API pública. Los errores viven en el dominio (`errors.ts`) porque son vocabulario del negocio,
no de la aplicación.

### Comandos npm (cambios)

Ninguno nuevo. `npm run lint` incorpora las cinco reglas; `npm run arch` las tres.

## Diseño de los puntos no triviales

- **`DomainError`** (R-01): `abstract readonly code`, `abstract readonly module`, `details:
SafeDetails` (`Readonly<Record<string, string | number | boolean>>`), `name = new.target.name`.
  Los subtipos declaran `readonly code = "…" as const` y `readonly module = "…" as const`.
  `ModuleName` es la unión de módulos del `CONTEXT_MAP` (replicada en el shared-kernel del
  dominio; la regla `domain-error-shape` verifica que `module` coincide con la carpeta).
- **`Result`**: `{ ok: true; value: T } | { ok: false; error: E }` con `ok<T>(value)` y
  `fail<E extends DomainError>(error)`. Sin métodos (`map`, `andThen`): ocho líneas.
- **Puertos de escritura**: `DecisionLedger.record(): Promise<Result<void, LedgerUnavailable>>`,
  `AssignmentLedger.record()` ídem, `ExposureLedger.record(): Promise<Result<ExposureRecordStatus,
LedgerUnavailable>>`. `RecordOutcome` desaparece.
- **`IngestBatchUseCase`** (R-02): `execute(request: IngestBatchRequest): Promise<Result<IngestOutcome,
IngestionError>>`. Orden sin cambio: `checkBatch` → `assignment.assign()` → dedup → `decideArm`
  → `noOp` → `decisions.record()`. `LedgerUnavailable` de `assign()` o de `record()` se degrada a
  `NO_OP ledger-unavailable` dentro del caso de uso (ADR-021): nunca sale como error.
- **`ConfirmExposureUseCase`**: `Result<ExposureRecordStatus, ExposureDecisionUnknown |
ExposureOfNoOp | LedgerUnavailable>`; el controller traduce con `toProblem` (503 +
  `Retry-After` por `HEADERS_BY_CODE`).
- **`ResolveIngestKeyUseCase`**: `Result<Merchant, Unauthorized | OriginNotAllowed>`; el security
  handler traduce con `toProblem`.
- **`GetServiceHealthUseCase`**: response directo (`ServiceHealth`), sin `Result` (edge case de
  la spec).
- **`AssignmentService`** (R-02): interfaz `{ assign(merchantId, visitorId): Promise<Result<Assignment |
undefined, LedgerUnavailable>> }`; `DefaultAssignmentService` con deps `{ experiments,
assignments, clock, logger }`. Las pruebas de `assign-visitor.test.ts` se mueven a
  `assignment.service.test.ts` con las mismas aserciones.
- **`toProblem`** (R-04): `PROBLEM_TYPES[error.code]` da `status` y `title`; `HEADERS_BY_CODE`
  da los headers; `instance` viene del controller. Los controllers no importan
  `problem-details.ts` directamente salvo para `500 internal-error` (error de programación).
- **`LoggedUseCase`** (R-05): `new LoggedUseCase("ingestBatch", inner, { clock, logger })`;
  log `info` `{ useCase, durationMs, outcome }` con `outcome = "ok" | code`. En composición
  envuelve los tres casos de uso servidos por HTTP.
- **Reglas** (R-03): cinco ESLint tipadas en `scripts/lint/` (mismo patrón que
  `no-magic-strings.mjs`: `ESLintUtils`-free, `context.sourceCode.parserServices` para el type
  checker), registradas en `eslint.config.mjs` con `files` acotados a `src/application/**` /
  `src/domain/**`; en `tests/lint/lint.test.ts` entran a `expected` bajo `as-src/`. Tres de
  dependency-cruiser con fixture en `tests/architecture/fixtures/src/`.
- **Orden de commits**: (1) shared-kernel (`UseCase`, `Result`, `DomainError`), errores por
  módulo, puertos con `Result`, `toProblem`, `HEADERS_BY_CODE`, helpers de prueba; (2) migración
  de los cinco casos de uso + `AssignmentService` + controllers + composición (suite verde sin
  cambiar aserciones); (3) decorador de registro aplicado en composición; (4) reglas ESLint y
  dependency-cruiser con fixtures, mapa de contextos; (5) ADR-023 aceptada, CLAUDE.md,
  quickstart.

## Complexity Tracking

| Elemento                                    | Por qué                                                                                                             | Alternativa rechazada                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Cinco reglas ESLint tipadas propias         | la forma "campo es interfaz" y "throw de DomainError" necesita el type checker; no hay regla existente              | reglas textuales en `shape-rules.mjs`: no distinguen interfaz de clase ni el tipo de un `throw`                |
| Errores en `domain/` y no en `application/` | son vocabulario de negocio (`session-visitor-mismatch` es una regla del lote) y el dominio ya los nombra como slugs | errores en aplicación: el dominio seguiría devolviendo strings y la conversión reaparecería                    |
| `experiment` depende de `ledger`            | `LedgerUnavailable` es un error del módulo `ledger` y `AssignmentLedger.record()` lo devuelve                       | duplicar el error en `experiment`: dos códigos para una misma condición, o un error en shared-kernel sin dueño |

## Re-evaluación del Constitution Check (post-Phase 1)

Sin cambio de contrato, dependencias hacia adentro con tres reglas más, errores con datos
seguros, orquestación a la vista en un solo caso de uso, todo verificado por herramienta con
fixture. **PASA.**
