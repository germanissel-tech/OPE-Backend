# Data model — Feature 008

No hay entidades de negocio nuevas: esta feature fija **tipos estructurales** de la capa de
aplicación y del núcleo compartido del dominio. Sin cambios de persistencia ni de contrato.

## Raíz de error (`domain/shared-kernel/errors.ts`)

| Campo     | Tipo                                                                  | Regla                                                                                         |
| --------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `code`    | literal (`abstract readonly`)                                         | slug estable = `type` de Problem Details sin prefijo; único entre módulos (prueba de réplica) |
| `module`  | `ModuleName` literal (`abstract readonly`)                            | coincide con la carpeta `domain/<módulo>/` del archivo (regla `domain-error-shape`)           |
| `message` | `string` (de `Error`)                                                 | apto para `detail` de Problem Details: sin datos personales ni internos                       |
| `details` | `SafeDetails = Readonly<Record<string, string \| number \| boolean>>` | sin `visitorId`, `sessionId` ni claves de la lista de PII; por defecto `{}`                   |
| `name`    | `string` (de `Error`)                                                 | `new.target.name`: el nombre de la clase, para logs y `instanceof`                            |

`ModuleName = "shared-kernel" | "system" | "merchant" | "ledger" | "experiment" | "ingestion"`.

## Errores por módulo (`domain/<módulo>/errors.ts`)

| Módulo      | Clase                      | `code`                         | Status (catálogo) | Hoy era                                               |
| ----------- | -------------------------- | ------------------------------ | ----------------- | ----------------------------------------------------- |
| `merchant`  | `Unauthorized`             | `unauthorized`                 | 401               | `reason: "unauthorized"`                              |
| `merchant`  | `OriginNotAllowed`         | `origin-not-allowed`           | 403               | `reason: "origin-not-allowed"`                        |
| `ingestion` | `SessionVisitorMismatch`   | `session-visitor-mismatch`     | 422               | `invariant: "session-visitor-mismatch"`               |
| `ingestion` | `EventTimestampOutOfRange` | `event-timestamp-out-of-range` | 422               | `invariant: "event-timestamp-out-of-range"`           |
| `ledger`    | `ExposureDecisionUnknown`  | `exposure-decision-unknown`    | 422               | `invariant: "exposure-decision-unknown"`              |
| `ledger`    | `ExposureOfNoOp`           | `exposure-of-no-op`            | 422               | `invariant: "exposure-of-no-op"`                      |
| `ledger`    | `LedgerUnavailable`        | `ledger-unavailable`           | 503               | `RecordOutcome = "unavailable"` / `unavailable: true` |

Cada archivo exporta la unión: `MerchantError`, `IngestionError`, `LedgerError`. `system` y
`experiment` no tienen errores propios (el `experiment` devuelve `LedgerUnavailable` del
`ledger`).

## Resultado (`domain/shared-kernel/result.ts`)

```ts
type Result<T, E extends DomainError> = { ok: true; value: T } | { ok: false; error: E };
ok<T>(value: T); fail<E extends DomainError>(error: E);
```

## Contrato de caso de uso (`application/shared-kernel/use-case.ts`)

`UseCase<Request, Response> { execute(request: Request): Promise<Response> }`.

| Caso de uso               | Request                                                               | Response                                                                                                  | `*Dependencies`                                                 |
| ------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `GetServiceHealthUseCase` | `void`                                                                | `ServiceHealth`                                                                                           | `{ clock }`                                                     |
| `ResolveIngestKeyUseCase` | `{ key?, origin? }`                                                   | `Result<Merchant, MerchantError>`                                                                         | `{ merchants }`                                                 |
| `IngestBatchUseCase`      | `{ merchantId, batch, receivedAt? }` (el input de hoy)                | `Result<IngestOutcome, IngestionError>`                                                                   | `{ clock, ids, logger, eventDedup, decisions, assignment }` (6) |
| `ConfirmExposureUseCase`  | `{ merchantId, decisionId, sessionId, visitorId, exposedAt, anchor }` | `Result<ExposureRecordStatus, LedgerError>` con `ExposureRecordStatus = "recorded" \| "already-recorded"` | `{ decisions, exposures }`                                      |

`IngestBatchUseCase` **maneja** `LedgerUnavailable` (degrada a `NO_OP ledger-unavailable`,
ADR-021); por eso no figura en su response.

## Servicio de aplicación (`application/experiment/services/assignment.service.ts`)

| Miembro                           | Firma                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `AssignmentService.assign`        | `(merchantId, visitorId) => Promise<Result<Assignment \| undefined, LedgerUnavailable>>` |
| `DefaultAssignmentService` (deps) | `{ experiments: ExperimentDirectory, assignments: AssignmentLedger, clock, logger }`     |

`undefined` = sin experimento activo (misma semántica que hoy).

## Puertos de escritura (cambio de firma)

| Puerto             | Antes                                                           | Ahora                                                                |
| ------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| `DecisionLedger`   | `record(): Promise<RecordOutcome>`                              | `record(): Promise<Result<void, LedgerUnavailable>>`                 |
| `AssignmentLedger` | `record(): Promise<RecordOutcome>`                              | `record(): Promise<Result<void, LedgerUnavailable>>`                 |
| `ExposureLedger`   | `record(): Promise<ExposureRecordStatus>` (con `"unavailable"`) | `record(): Promise<Result<ExposureRecordStatus, LedgerUnavailable>>` |

## Traducción (`interface-adapters/http/to-problem.ts`)

`toProblem(error: DomainError, instance: string) → { status, body: ProblemDetails, headers? }`
con `body.type = urn:ope:problem:${code}`, `status`/`title` de `PROBLEM_TYPES[code]`,
`detail = message`, `instance`. `HEADERS_BY_CODE`: `ledger-unavailable → { "retry-after": "5" }`.

## Decorador (`application/shared-kernel/decorators/logged-use-case.ts`)

`LoggedUseCase<I, O>(name, inner: UseCase<I, O>, { clock, logger })`; log por ejecución
`{ useCase: name, durationMs, outcome: "ok" | <code> }`. Si el response no es un `Result`
(caso de uso que no falla), `outcome = "ok"`.
