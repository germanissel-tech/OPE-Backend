---
numero: 23
titulo: Casos de uso, servicios de aplicación y errores de negocio
estado: propuesta
fecha: 2026-09-17
fuente: specs/008-casos-de-uso-y-errores/research.md
---

# ADR-023 — Casos de uso, servicios de aplicación y errores de negocio

## Contexto

Las features 004–007 construyeron la capa de aplicación con fábricas de funciones que
reciben los puertos por closure, cada una con su propia forma de resultado (`{ ok, invariant }`,
`{ ok, reason }`, `{ ok, unavailable }`), sin contrato común, con un caso de uso invocando a
otro y con errores de negocio como strings que cada controller traduce a mano. Con el plano de
decisión la aplicación va a multiplicar sus casos de uso; hace falta una forma única,
reconocible y verificada por herramienta (ADR-016), sin conversiones de tipo en las fronteras.

## Decisión

1. **Contrato**: `UseCase<Request, Response> { execute(request): Promise<Response> }` en
   `application/shared-kernel/`. Cada caso de uso es una clase `*UseCase`, una por archivo,
   en `application/<módulo>/use-cases/`, que implementa el contrato. El **request** es lo que
   cambia por llamada; las **dependencias** llegan por el constructor como un único objeto
   tipado por una interfaz `*Dependencies` del mismo archivo cuyos campos son interfaces
   (puertos, servicios, `Clock`, `IdGenerator`, `Logger`), con un máximo de **seis**. Un caso
   de uso **nunca** importa ni invoca a otro caso de uso.
2. **Servicios de aplicación**: la lógica compartida que necesita puertos es una interfaz
   `*Service` con implementación `Default*Service` en `application/<módulo>/services/`,
   inyectada por interfaz. Un servicio puede usar otros servicios; no importa casos de uso.
   El primero es `AssignmentService` (ADR-022).
3. **Errores**: raíz `DomainError` (abstracta, extiende `Error`) en el `shared-kernel` del
   dominio con `code` (slug estable, igual al `type` del catálogo de problemas sin prefijo),
   `module` (módulo emisor) y `details` (datos seguros, sin datos personales). Cada módulo
   define sus errores en `domain/<módulo>/errors.ts` con `code` y `module` literales y exporta
   su unión. Los errores de negocio **se devuelven** en `Result<T, E extends DomainError>`
   (`ok(value)` / `fail(error)`); **nunca se lanzan**. `throw` queda para errores de
   programación (`Error`), que el adaptador HTTP convierte en `500 internal-error`. Un caso de
   uso que no puede fallar por negocio devuelve el valor directo.
4. **Traducción**: una única `toProblem(error, instance)` en `interface-adapters/http/`
   produce Problem Details (`type` desde `code`, `status` y `title` desde el catálogo,
   `detail` desde `message`, headers por código). Los controllers no construyen errores. La
   réplica de códigos contra `contracts/problem-types.yaml` se verifica por prueba: todo
   `code` existe con su status y es único.
5. **Decoradores**: una preocupación transversal es un `UseCase<I, O>` que envuelve otro, en
   `application/shared-kernel/decorators/`, aplicado en composición. El primero es el registro
   operativo (nombre, duración, `ok` o `code`; nunca el request).
6. **Verificación**: reglas ESLint tipadas `ope/use-case-shape`,
   `ope/dependencies-are-interfaces`, `ope/domain-error-shape`, `ope/no-throw-domain-error`,
   `ope/no-generic-catch-in-application`; reglas de dependency-cruiser
   `use-cases-no-use-cases`, `services-no-use-cases`, `problem-translation-only-in-http`.
   Cada una con fixture que la viola.

## Consecuencias

- Un caso de uso nuevo se escribe en un archivo de aplicación más, si hace falta, su error en
  el `errors.ts` de su dominio y una entrada en el catálogo de problemas; no toca el adaptador
  HTTP.
- Quien consume un caso de uso conoce por tipo la unión exacta de errores posibles y decide
  con un `switch` exhaustivo; ampliar la unión rompe la compilación de los consumidores que no
  la cubren.
- Superar seis dependencias no se resuelve relajando el límite sino extrayendo un servicio.
- Los puertos de escritura devuelven `Result<…, LedgerUnavailable>`: `RecordOutcome` (ADR-021)
  se retira; la semántica fail-closed de ADR-021 no cambia. El módulo `experiment` depende de
  `ledger` en el mapa de contextos.
- Los errores viven en el dominio porque son vocabulario de negocio; la aplicación sólo los
  devuelve.
