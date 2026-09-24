---
paths:
  - "src/application/**"
---

# Cómo se escribe un caso de uso (ADR-023, verificado por `lint` y `arch`)

- Un archivo `src/application/<módulo>/use-cases/<nombre>.use-case.ts` que exporta **una** clase
  `<Nombre>UseCase implements UseCase<Request, Response>` con `execute(request)`. Lo que cambia
  por llamada va en el request; lo que necesita para operar llega por el constructor como un
  único objeto tipado por una interfaz `<Nombre>Dependencies` del mismo archivo, cuyos campos
  son interfaces (puertos de `ports/`, servicios `*Service`, `Clock`, `Logger`),
  **seis como máximo** (`ope/dependencies-are-interfaces`). Superarlo se resuelve extrayendo un
  servicio, no relajando el límite.
- Un caso de uso **nunca** importa ni invoca a otro caso de uso (`use-cases-no-use-cases`). Lo
  compartido que necesita puertos es una interfaz `*Service` en `services/` —el rol del que
  depende el consumidor (`AssignmentService`, `ScopedMerchantService`)— y su implementación lleva
  el **plural de lo que responde** (`Assignments`, `ScopedMerchants`, `ProductTruths`), nunca un
  prefijo vacío: `Default` no distinguía nada porque no hay nada que distinguir —hay una sola
  implementación y ningún mecanismo que nombrar—, y qué clase se enlaza se lee en
  `composition/modules/<módulo>.ts`. Cuando haya dos, la segunda se nombra por su mecanismo, como
  los gateways (`RuleBasedBarrierInference`, `memoryMerchantStore`). Un servicio no importa
  casos de uso (`services-no-use-cases`). Autenticación y autorización tampoco son casos de
  uso: son servicios (`IngestKeyResolver`) que el security handler consulta antes de validar el
  body y antes de cualquier caso de uso; un caso de uso recibe el merchant resuelto, nunca la
  credencial.
- Un error de negocio es una clase en `src/domain/<módulo>/errors.ts` que extiende
  `DomainError` con `readonly code = "<slug>" as const` y `readonly module = MODULE` (la carpeta;
  `ope/domain-error-shape`), y el archivo exporta la unión del módulo. El `code` es el slug del
  catálogo `contracts/problem-types.yaml`: agregar un error = agregar su entrada allí (la prueba
  de réplica falla si falta). La response del caso de uso es `Result<T, <unión exacta>>`
  (`ok(value)` / `fail(error)`); un caso de uso que no puede fallar devuelve el valor directo.
  Un `DomainError` **se devuelve, nunca se lanza** (`ope/no-throw-domain-error`); `throw new
Error` queda para errores de programación (→ `500`). Sin `try/catch` en `application/`
  (`ope/no-generic-catch-in-application`): los puertos devuelven `Result`.
- La traducción a HTTP es una sola: `toProblem(error, instance)` en
  `interface-adapters/http/to-problem.ts` (`type` desde `code`, status y título del catálogo
  generado); sólo el borde HTTP del anillo la importa (controllers, presenters, security;
  `problem-translation-only-in-http`). Los controllers no construyen errores. Los headers de un
  status son del transporte: `Retry-After` de toda `503` lo agrega la infraestructura con
  `retryAfterSeconds` del nivel de plataforma.
- **Preocupaciones transversales: nadie las elige** (ADR-023, feature 021). Un `UseCase<I, O>` que
  envuelve otro, en `application/shared-kernel/decorators/` (`LoggedUseCase`: nombre del **caso de
  uso**, duración y `ok` o `code`, nunca el request; `AuditedUseCase`: lo que un operador hizo, por
  el puerto `AuditTrail` del kernel que `admin` implementa, ADR-034). **Qué se aplica lo dice el
  contrato, no el módulo**: se audita si y sólo si el consumidor es `admin` y la capacidad no es de
  lectura, y eso lo deriva `contract:types` a `generated/audited-operations.{js,d.ts}`
  (`AuditedOperation`). La decoración la declara el kernel una vez (`serves.decoration`) y la
  aplica la biblioteca del grafo al construir cada handler; el controller recibe el caso de uso
  **ya envuelto**. Una operación que el contrato manda auditar, servida por un caso de uso cuyo
  request no lleva operador, **no compila** (`CannotAudit<"<operationId>">`). La semilla del
  arranque no pasa por ahí —no son operaciones del contrato— y audita sin loguear por el
  componente `kernel.audit`.
- **Una acción administrativa que no se pudo auditar no ocurre** (ADR-034, enmienda del
  2026-09-23): el decorador pregunta al registro **antes** de ejecutar y, si no acepta escrituras,
  responde `503 store-unavailable` sin que la acción haya pasado. Fallar después sería peor que no
  fallar. La semilla es una acción administrativa también, así que un servidor cuyo registro
  rechaza escrituras desde el arranque **no arranca**. Queda abierta la ventana en que el registro
  se cae durante la acción; se cierra con la transacción del hito `persistence-and-resilience`.
- Cómo se registra un error de negocio lo declara **el error**: sólo el que deniega lo dice
  (`MerchantOutOfScope`), y cualquier otro es un rechazo. El kernel no compara códigos por texto.
- Cada regla `ope/*` vive en `scripts/lint/<regla>.mjs` (plugin `scripts/lint/plugin.mjs`) con su
  fixture en `tests/lint/fixtures/as-src/` y las de arquitectura en
  `tests/architecture/fixtures/src/`.
