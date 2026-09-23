---
numero: 23
titulo: Casos de uso, servicios de aplicación y errores de negocio
estado: aceptada
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
   `*Service` en `application/<módulo>/services/`, inyectada por interfaz. Un servicio puede usar
   otros servicios; no importa casos de uso. El primero es `AssignmentService` (ADR-022).
   - Enmienda (2026-09-22): la implementación se llamaba `Default*Service`. `Default` no
     distinguía nada —hay una sola implementación de cada servicio y ningún mecanismo que
     nombrar— y qué clase se enlaza ya se lee en `composition/modules/`. Ahora la clase lleva el
     **plural de lo que el servicio responde** (`AssignmentService` ⇒ `Assignments`,
     `ScopedMerchantService` ⇒ `ScopedMerchants`); la segunda implementación, si llega, se nombra
     por su mecanismo como los gateways (`RuleBasedBarrierInference`).
   - Precisión (2026-09-18): **autenticación y autorización no son casos de uso**. Resolver una
     credencial (`IngestKeyResolver`, y los que traigan `portalSession`, `adminToken` y las
     capacidades) es una política que el adaptador de seguridad consulta **antes** de validar el
     body y antes de cualquier caso de uso; vive en `services/` del módulo que la posee y los
     casos de uso reciben el merchant ya resuelto, nunca la credencial.
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

### Enmienda (2026-09-23) — la preocupación transversal no se elige: la deriva el contrato

Los decoradores se aplicaban a mano, handler por handler: `logged` o `administered`, 29 veces.
Cruzada contra el contrato, esa elección coincidía **29 de 29** con una regla que ya estaba
escrita ahí —se audita si y sólo si el consumidor es `admin` y la capacidad no es de lectura—, y
ninguna regla la verificaba: escribir `logged` donde iba `administered` compilaba, pasaba los siete
gates y pasaba las pruebas, y esa operación dejaba de auditarse en silencio. Para un registro que
es requisito (01 §14.2) es el peor modo de falla.

Se decide:

1. **La regla la deriva `contract:types`** a `generated/audited-operations.{js,d.ts}`, del bundle
   y del mapa. No es una réplica que pueda divergir: si el contrato cambia, el tipo cambia.
2. **El módulo declara el caso de uso y el controller, y nada más** (`served()`). La biblioteca del
   grafo envuelve; el controller recibe el caso de uso **ya envuelto**, así que no hay forma de
   saltear la decoración. `UseCaseDecorators` —una bolsa de tres funciones declarada en el
   composition root, de la que dependían los 29 handlers— desaparece.
3. **Lo que queda enforzable, lo enforza el compilador.** Derivada la elección no hay nada que
   olvidar; lo que la plataforma no puede verificar sola es que el caso de uso sirva para auditar,
   porque la entrada necesita el operador. Una operación que el contrato manda auditar servida por
   un caso de uso cuyo request no lo lleva no compila (`CannotAudit<"…">`), con su fixture de tipos.
4. **Cómo se registra un error lo declara el error**, no el kernel comparando texto un código de
   otro módulo que no puede ni importar.

Se evaluó y se descartó un gate `check:*` que verificara la elección a mano: la garantía
estructural es más fuerte que un script, y el script se habría borrado en el mismo ciclo.

La semilla del arranque no entra por acá —no son operaciones del contrato, no tienen consumidor ni
capacidades— y se declara explícitamente por el componente `kernel.audit`. Inventarle un consumidor
para que entrara por el mismo camino habría sido mentirle al contrato por simetría.

## Consecuencias

- Precisión (2026-09-18): `DomainError.module` es `string`, no una unión `ModuleName` mantenida
  en el `shared-kernel`. Esa unión invertía la dependencia (el núcleo enumeraba a sus
  consumidores) y era redundante: `ope/domain-error-shape` verifica con el type checker que el
  literal coincide con la carpeta. Cada `errors.ts` declara `const MODULE = "<módulo>" as const`.

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
