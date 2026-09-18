# Research — Feature 008: casos de uso uniformes, servicios de aplicación y errores estandarizados

**Fecha**: 2026-09-17 · **Estado**: completo. Decisión transversal → ADR-023 durante la
implementación.

## R-01 Jerarquía de errores con `code` literal (verificado)

- **Decisión (DECIDIDO → ADR-023)**: `DomainError` abstracta que extiende `Error` con
  `abstract readonly code: string`, `abstract readonly module: string` y `details` (datos
  seguros) asignado en el constructor; cada error concreto declara `readonly code = "…" as
const` y `readonly module = "…" as const`. `Result<T, E extends DomainError>` con `ok()` y
  `fail()`.
- **Verificado** (`node_modules/.cache/probe-008/errors.ts` con el `tsconfig` del repo):
  compila con `erasableSyntaxOnly` y `strict` (sin _parameter properties_: campos declarados y
  asignados en el constructor); un `switch` sobre `error.code` de la unión de respuesta es
  exhaustivo (quitar un caso → `TS2366`); `Result<number, Error>` no compila (`Error` no es
  `DomainError`); `module` estrecha a la unión de módulos; `instanceof DomainError` sigue
  disponible para la frontera HTTP.
- **Alternativa rechazada**: objetos planos `{ code, message }` sin clase — pierden `stack` y
  `instanceof` en la frontera, y `Error` es lo que el logger y Fastify saben serializar.
  Errores con prefijo de módulo en el `code` (`ingestion/session-visitor-mismatch`): la
  unicidad ya la garantiza el catálogo de problemas, y el `code` es el `type` de Problem
  Details tal cual.

## R-02 Contrato de caso de uso y dependencias

- `UseCase<Request, Response> { execute(request): Promise<Response> }` en
  `application/shared-kernel/use-case.ts`. Clases `*UseCase` en `application/<módulo>/use-cases/`
  (`<nombre>.use-case.ts`), una por archivo, `implements UseCase<…>`.
- Constructor con un único parámetro tipado por una interfaz `*Dependencies` declarada en el
  mismo archivo: campos que son interfaces de `ports/`, de `services/` o utilidades del
  `shared-kernel` (`Clock`, `IdGenerator`, `Logger`); límite de **seis** campos. Por qué
  objeto y no posicionales: `max-params: 4` (005), cableado legible por nombre, agregar una
  dependencia no rompe llamadas.
- Servicios: `application/<módulo>/services/<nombre>.service.ts` con interfaz `*Service` e
  implementación `Default*Service` (constructor con `*Dependencies` también). El primero:
  `AssignmentService` (de `assign-visitor.ts`), inyectado en `IngestBatchUseCase`.
- Los casos de uso que hoy existen y su destino:

  | Hoy                    | 008                            | Response                                                                                                                                                           |
  | ---------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `makeGetServiceHealth` | `GetServiceHealthUseCase`      | `ServiceHealth` (no falla)                                                                                                                                         |
  | `makeResolveIngestKey` | `ResolveIngestKeyUseCase`      | `Result<Merchant, Unauthorized \| OriginNotAllowed>`                                                                                                               |
  | `makeAssignVisitor`    | `AssignmentService` (servicio) | `Result<Assignment \| undefined, LedgerUnavailable>`                                                                                                               |
  | `makeIngestBatch`      | `IngestBatchUseCase`           | `Result<IngestOutcome, IngestionError>` — `LedgerUnavailable` de los puertos se degrada a `NO_OP` **dentro** del caso de uso (ADR-021) y no figura en la respuesta |
  | `makeConfirmExposure`  | `ConfirmExposureUseCase`       | `Result<ExposureRecordStatus, ExposureDecisionUnknown \| ExposureOfNoOp \| LedgerUnavailable>`                                                                     |

  Precisión sobre la ingesta: ADR-021 fija que la ingesta **no** falla ante ledger no
  disponible sino que degrada a `NO_OP` `ledger-unavailable` (202). El caso de uso conserva
  ese comportamiento: `LedgerUnavailable` es un error que los puertos devuelven y el caso de
  uso **maneja**, y su response sigue siendo `Result<IngestOutcome, IngestionError>`. La
  exposición sí lo propaga (503).

- Puertos: `record()` pasa de `"accepted" | "unavailable"` a `Result<void, LedgerUnavailable>`
  (y `Result<ExposureRecordStatus, LedgerUnavailable>` para exposiciones): el mismo tipo en
  toda la aplicación, sin strings mágicos. `LedgerUnavailable` es del módulo `ledger`; el
  módulo `experiment` lo importa por el `index.ts` de `ledger` → mapa de contextos:
  `experiment: [shared-kernel, ledger]`.

## R-03 Verificación: qué regla en qué herramienta

Las reglas de forma de la 005 son textuales (`scripts/shape-rules.mjs`) y `ope/no-magic-strings`
ya es una regla de ESLint con el programa de TypeScript. Las nuevas necesitan tipos, así que
van como reglas ESLint tipadas en `scripts/lint/` (un archivo por regla, fixture por regla en
`tests/lint/fixtures/`, registradas en `eslint.config.mjs` bajo `ope/*`), salvo las de
dependencia, que son de dependency-cruiser:

| Regla                                 | Herramienta        | Qué verifica                                                                                                                                                                                                           |
| ------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ope/use-case-shape`                  | ESLint tipada      | archivo bajo `application/**/use-cases/` exporta exactamente una clase `*UseCase` que `implements UseCase`, con `execute` y un constructor de un parámetro cuyo tipo es una interfaz `*Dependencies` del mismo archivo |
| `ope/dependencies-are-interfaces`     | ESLint tipada      | cada miembro de una interfaz `*Dependencies` es de tipo interfaz (no clase ni función suelta salvo `UseCase`/`*Service`); ≤ 6 miembros (`maxDependencies`)                                                             |
| `ope/domain-error-shape`              | ESLint tipada      | en `domain/<m>/errors.ts` toda clase extiende `DomainError`, con `code` y `module` literales y `module === m`; exporta una unión                                                                                       |
| `ope/no-throw-domain-error`           | ESLint tipada      | `throw` cuyo tipo es asignable a `DomainError` falla (en `domain/` y `application/`)                                                                                                                                   |
| `ope/no-generic-catch-in-application` | ESLint             | `try/catch` en `application/` falla (los puertos no lanzan; los errores son valores)                                                                                                                                   |
| `use-cases-no-use-cases`              | dependency-cruiser | `application/**/use-cases/` no importa `**/use-cases/`                                                                                                                                                                 |
| `services-no-use-cases`               | dependency-cruiser | `application/**/services/` no importa `**/use-cases/`                                                                                                                                                                  |
| `problem-translation-only-in-http`    | dependency-cruiser | sólo `interface-adapters/http/` importa `to-problem.ts`                                                                                                                                                                |
| réplica de códigos                    | prueba             | todo `code` de `domain/**/errors.ts` existe en `problem-types.yaml` con status; únicos                                                                                                                                 |

Las tres reglas de dependency-cruiser tienen su fixture en `tests/architecture/fixtures/`.

## R-04 Traducción HTTP y headers por código

- `interface-adapters/http/to-problem.ts`: `toProblem(error: DomainError, instance: string) →
{ status, body, headers? }` con `type = urn:ope:problem:<code>`, `status`/`title` del
  catálogo (`PROBLEM_TYPES[code]`), `detail = error.message`, `instance`; `headers` por código
  (hoy sólo `ledger-unavailable` → `Retry-After`). Tipado: `code` de los errores de dominio
  es un subtipo de `ProblemSlug`, verificado por la prueba de réplica (el dominio no puede
  importar el catálogo del adaptador).
- Los controllers quedan en: `const r = await useCase.execute(req→request); return r.ok ?
success(r.value) : toProblem(r.error, req.instance)`.

## R-05 Decorador de registro

- `application/shared-kernel/decorators/logged-use-case.ts`: `class LoggedUseCase<I, O>
implements UseCase<I, O>` que envuelve otro `UseCase<I, O>` con nombre, `Clock` (o
  `performance.now` vía un puerto de tiempo monótono — se usa `Clock` para no sumar puertos)
  y `Logger`; registra `{ useCase, durationMs, outcome: "ok" | code }`. Sin request ni
  `details`. Se aplica en `composition/modules/<módulo>.ts` al construir el handler.
- Un decorador no es un caso de uso: vive en `shared-kernel/decorators/`, fuera de
  `use-cases/`, para que `ope/use-case-shape` no lo cuente.

## R-06 Migración sin cambiar comportamiento

- Orden: (1) `shared-kernel` (`UseCase`, `Result`, `DomainError`, decorador); errores por
  módulo; puertos con `Result`; `toProblem`; (2) casos de uso y servicio, uno por uno, con las
  pruebas unitarias existentes adaptadas sólo en la construcción del sujeto (`new
IngestBatchUseCase({ … })` en vez de `makeIngestBatch({ … })`) y en la forma del resultado
  (`r.error.code` en vez de `r.invariant`); (3) controllers y composición; (4) reglas y
  fixtures; (5) guía. Las pruebas de integración y Schemathesis no cambian.
- Los `it.todo`/`[invariant:<slug>]` de las invariantes siguen válidos: la prueba nombra el
  slug, que ahora es el `code` de la clase.
