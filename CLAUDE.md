# OPE-Backend — instrucciones para agentes

Backend del MVP de OPE (Zona B). Se construye de cero; la POC no es base de código.
Idioma (ADR-015): documentación, specs, ADRs, glosario y commits en **español**. Código, comentarios,
strings, mensajes de error y de log, contrato OpenAPI (descripciones, catálogos, mensajes de reglas),
configuraciones y CI en **inglés**; `npm run check:language` lo hace cumplir. Excepción en línea:
`// lang:es -- motivo` (sin motivo falla; se cuentan, objetivo `Language exceptions: 0`).

## Fuentes de verdad, en este orden

1. `.specify/memory/constitution.md` — principios y gates. Prevalece sobre todo lo demás.
2. Documentos del MVP (fuera del repo, en `../`): `01-arquitectura-mvp.md`,
   `02-integracion-ecommerce.md`, `03-alcance-mvp.md`. Si no podés leerlos, la sesión se lanzó
   sin `--add-dir ..`; pedilo antes de asumir.
3. `specs/NNN-*/` — spec, plan y tareas de cada feature.
4. `contracts/openapi.yaml` — única fuente de verdad de toda superficie HTTP.

## Flujo de trabajo (inamovible)

`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
Nada se implementa sin spec ni plan. El plan debe pasar el Constitution Check.

Dentro de una feature que toca HTTP, el orden es:

0. La operación existe en `contracts/api-map.yaml` como `planned`, con consumidor, tag,
   capacidades, feature y fuente (ADR-019). Nada entra al contrato sin estar antes en el mapa:
   `check:api-map` compara los dos en ambos sentidos. Construirla es pasarla a `built` y, si es
   la primera de su consumidor, referenciar su esquema de seguridad desde la raíz.
1. Cambiar el contrato en `contracts/` (multi-archivo, `$ref`). La raíz `openapi.yaml` no
   declara `components` (salvo `securitySchemes`, que `security` referencia por nombre): cada
   archivo de `components/` se referencia por ruta relativa desde donde se usa y el bundle lo
   promueve a `#/components/<tipo>/<NombreDeArchivo>`.
2. `npm run contract:check` en verde (lint, bundle, compatibilidad contra `main`, drift de
   tipos). Si agrega una regla nueva al ruleset, agregar su fixture en
   `tests/contract-rules/fixtures/` (la prueba falla si falta).
3. Regenerar tipos (`npm run contract:types`). **Nunca editar lo generado a mano.**
4. Reglas puras y errores en `src/domain/<módulo>/` (`errors.ts`), caso de uso en
   `src/application/<módulo>/use-cases/`, servicios en `services/` y puertos en `ports/`
   (ver "Cómo se escribe un caso de uso"), controller en
   `src/interface-adapters/<módulo>/controllers/<operacion>.ts` tipado con
   `OperationHandler<"<operationId>">` (sólo traduce DTO ↔ request/response; lee el merchant con
   `merchantOf(req)`; un fallo se responde con `toProblem(result.error, req.instance)`; lo que
   varios controllers del módulo comparten —dominio → DTO— en `<módulo>/presenters.ts`; su
   security handler en `<módulo>/security/`), gateway del puerto en
   `src/interface-adapters/<módulo>/gateways/`, todo exportado por
   `src/interface-adapters/<módulo>/index.ts`, y
   cableado en `src/composition/modules/<módulo>.ts` (el módulo declara su slice de puertos,
   su tabla de enlaces por tecnología, instancia sus casos de uso con `new` —envueltos en
   `LoggedUseCase`— y entrega sus controllers; el
   perfil en `profiles/local.ts` compone esa tabla). Un módulo nuevo es una línea en `MODULES` y otra en `CONTEXT_MAP`;
   `bootstrap.ts` no nombra ninguna operación y se niega a arrancar si el contrato declara una
   que ningún módulo sirve. El servidor rutea por `operationId`; no hay otro mecanismo de rutas.
5. `npm run format:check && npm run quality && npm run typecheck && npm test && npm run test:mutation && npm run test:contract`
   en verde. El hook de pre-commit corre formato, lint y typecheck sobre lo staged; el resto lo
   corre CI.

Antes del paso 1, si la operación trae **un sustantivo nuevo**, su nota en `docs/dominio/`
(ADR-008); si trae **una regla que el esquema no expresa**, su `x-invariants` con tipo propio
en `contracts/problem-types.yaml` y una prueba `[invariant:<slug>]` (ADR-007); si toma **una
decisión transversal**, su ADR en `docs/adr/` (ADR-009).

### Comandos

| Comando                                           | Qué hace                                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run contract:lint`                           | Redocly (estructura) + Spectral (`contracts/.spectral.yaml`, reglas `ope-*`)                                                                                                                                                                                                   |
| `npm run contract:bundle`                         | Bundle en `contracts/dist/openapi.yaml` (derivado, no se commitea)                                                                                                                                                                                                             |
| `npm run contract:diff`                           | Cambios incompatibles contra `origin/main` (oasdiff); `CONTRACT_BASE_REF` para otra base; con `info.x-stability: building` los reporta y acepta                                                                                                                                |
| `npm run contract:types` / `contract:types:check` | Regenera `generated/api.d.ts` y `generated/problem-types.{js,d.ts}` (fuera de `src/`, leídos por `#generated/*`) / falla si alguno está desactualizado                                                                                                                         |
| `npm run contract:check`                          | lint → bundle → diff → drift de tipos. Corre antes de cualquier commit                                                                                                                                                                                                         |
| `npm run contract:docs`                           | `docs/api/index.html` autocontenido; se rehúsa si `contract:check` falla                                                                                                                                                                                                       |
| `npm run contract:insomnia`                       | `docs/api/insomnia.json`: colección de Insomnia derivada del bundle (un request por operación, header de credencial, instantes vivos)                                                                                                                                          |
| `npm run build` / `dev` / `typecheck`             | `tsc` a `dist/` / servidor real en memoria con `config/dev-merchants.json` (sin mock, ADR-018) / `tsc --noEmit`                                                                                                                                                                |
| `npm test` / `test:tools` / `test:all`            | Vitest, proyecto `fast`: unitarias, integración (`fastify.inject`), reglas del contrato, compatibilidad, gobernanza, arquitectura / proyecto `tools` (auditoría sobre fixtures, cadena de calidad, documentación) / ambos, como CI                                             |
| `npm run test:scoped`                             | Los proyectos de Vitest que el cambio necesita: `fast` siempre; `tools` sólo si cambió `scripts/`, `.claude/`, `contracts/`, `docs/`, `tests/audit/`, la cadena de calidad, `contract-docs`, `vitest*`, `package.json` o `.github/` (lo que corre CI); `-- --all` = `test:all` |
| `npm run test:contract`                           | Schemathesis (`uvx`) contra el servidor levantado                                                                                                                                                                                                                              |
| `npm run arch`                                    | dependency-cruiser sobre `src/`: anillos, módulos y composición (ADR-013)                                                                                                                                                                                                      |
| `npm run check:invariant-tests`                   | Toda `x-invariants` del contrato tiene su prueba `[invariant:<slug>]`                                                                                                                                                                                                          |
| `npm run check:glossary`                          | Todo sustantivo del contrato resuelve a `docs/dominio/`; toda nota con fuente                                                                                                                                                                                                  |
| `npm run check:identifiers`                       | Todo identificador citado entre comillas de código en constitución, ADR y glosario existe en el contrato, sus catálogos, `src/` o el tooling; allowlist con motivo en `scripts/identifiers-allowlist.json`                                                                     |
| `npm run check:adrs`                              | Frontmatter de `docs/adr/` y ninguna cita `ADR-NNN` rota                                                                                                                                                                                                                       |
| `npm run check:markers`                           | Lista `ABIERTO` / `PROPUESTO` / `PLACEHOLDER`; `-- --strict` falla con bloqueantes                                                                                                                                                                                             |
| `npm run check:api-map`                           | Mapa del contrato ↔ contrato en los dos sentidos; consumidores, capacidades, esquemas, features, fuentes, ciclo de vida                                                                                                                                                        |
| `npm run check:language`                          | Texto en español en comentarios, strings, contrato, configs o CI (lista `scripts/language-denylist.json`)                                                                                                                                                                      |
| `npm run format` / `format:check`                 | Prettier: formatea todo / falla si algo difiere del formato canónico (único formateador, ADR-011)                                                                                                                                                                              |
| `npm run lint` / `lint:fix`                       | ESLint estricto con tipos + conteo de excepciones (`Lint exceptions: N`) / arregla lo automático                                                                                                                                                                               |
| `npm run release-check`                           | `contract:check` + marcadores en modo estricto: la puerta antes de publicar                                                                                                                                                                                                    |
| `npm run check:duplication`                       | jscpd: clones estructurales; bloquea en `src/`, informa en `tests/` y `scripts/`                                                                                                                                                                                               |
| `npm run check:dead-code`                         | knip: archivos, exports y dependencias sin uso bloquean; tipos exportados sin uso informan                                                                                                                                                                                     |
| `npm run check:behaviour-constants`               | Ninguna constante de comportamiento en `src/` (constitución XI): los archivos retirados no existen y ningún archivo declara sus nombres; `-- --src <dir>` para un fixture                                                                                                      |
| `npm run quality`                                 | `lint` → `arch` → `check:duplication` → `check:dead-code` → `check:language`; se detiene en el primero rojo                                                                                                                                                                    |
| `npm run test:load`                               | Carga informativa con autocannon sobre el servidor construido (`OPE_LOAD_DURATION`, `_CONNECTIONS`, `_VISITORS`); nunca falla por las cifras                                                                                                                                   |
| `npm run test:mutation`                           | Stryker sobre las líneas de `src/` cambiadas contra `origin/main` (incluye archivos sin trackear); `-- --files a.ts,b.ts:10-20` muta sólo eso, con `--force`, para iterar sobre un superviviente; `-- --all` muta todo, informativo, con su propio archivo incremental         |

Los seis `check:*` de gobernanza corren dentro de `contract:check`; `quality` encadena los gates de calidad (ADR-016): `lint` → `arch` → `check:duplication` → `check:dead-code` → `check:language` → `check:behaviour-constants`.

### Anillos y módulos (ADR-013, verificado por `npm run arch`)

`src/` contiene `main.ts`, `composition/` y cuatro anillos; nada más. Dependencia sólo hacia
adentro:

| Anillo                    | Qué va ahí                                                                                                                                                                                                                                       | Puede importar de                                                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/`             | reglas y valores puros, por módulo                                                                                                                                                                                                               | sólo `domain/`. **Nada de npm ni de Node, ni tipos**                                                                                                                                                                                   |
| `src/application/`        | casos de uso y **los puertos que definen** (`<módulo>/ports/`), por módulo                                                                                                                                                                       | `domain/`, `application/`. Tampoco npm ni Node                                                                                                                                                                                         |
| `src/interface-adapters/` | todo lo que **traduce**, por módulo: `<módulo>/{controllers/, presenters.ts, security/, gateways/, index.ts}` (entrada y salida por nombre); núcleo `http/` sin módulos (tipado, Problem Details, borde genérico, principales); `shared-kernel/` | `application/`, `domain/`, `node:`. El mapa de contextos rige también aquí; un gateway no importa otro gateway ni npm (los drivers entran por `infrastructure/`); un controller no importa gateways; el núcleo no conoce ningún módulo |
| `src/infrastructure/`     | sólo lo que **hospeda o provee tecnología**: Fastify + openapi-backend, CORS, logging (mañana el driver de Postgres)                                                                                                                             | todo menos `composition/` y `main.ts`                                                                                                                                                                                                  |
| `src/composition/`        | `Ports` (intersección de slices), perfiles, `modules/<módulo>.ts` (se cablea solo; del anillo importa sólo `interface-adapters/<módulo>/index.js`), `adapters/` (lo que une puertos de varios módulos), `bootstrap()`, `*-config.ts`             | todo; sólo `main.ts` y las pruebas lo importan. Controllers y casos de uso sólo desde `modules/`                                                                                                                                       |
| `src/main.ts`             | lee configuración, `bootstrap`, señales                                                                                                                                                                                                          | `composition/` y Node; nadie lo importa                                                                                                                                                                                                |

Fuera de `src/`: `generated/` (lo que `contract:types` deriva del contrato; nunca editado;
importable sólo desde `interface-adapters/http/` e `infrastructure/http/` como `#generated/*`) y
`client/` (el cliente tipado para consumidores; nada de `src/` lo importa). Qué contiene cada
directorio de primer nivel lo dice su `README.md` (ADR-032; verificado por `tests/docs`):
`config/`, `contracts/`, `generated/`, `patches/`, `scripts/`, `docs/`, `tests/`, `client/`,
`specs/`.

**Módulos** dentro de `domain/`, `application/` e `interface-adapters/`: `shared-kernel`, `system`, `operator`
(quién opera: `Operator`, `OperatorId`, alcance; sólo dominio), `merchant`,
`ledger`, `experiment`, `ingestion`, `catalog`, `barrier`, `selection`, `commercial`, `decision`,
`outcomes`, `configuration` (los tres niveles y su resolución; nadie lo importa: cada consumidor
define su puerto de lectura y la composición enlaza), `admin` (operadores, registro de
administración, diagnóstico de anclajes) — los demás cuando llegue su feature. Dentro de un módulo
de aplicación: `use-cases/`, `services/`, `ports/`; en el dominio, `errors.ts` (ADR-023). Cada módulo expone su API pública
en `index.ts`; un módulo importa de otro **sólo por su `index.ts`** y sólo si el mapa de
contextos (`CONTEXT_MAP` en `.dependency-cruiser.cjs`) lo permite. Agregar un módulo =
agregar una entrada al mapa. Cada regla tiene un fixture en `tests/architecture/fixtures/`.

**Composición** (DI manual, sin contenedor): cada `src/composition/modules/<módulo>.ts` declara
los puertos que necesita (`LedgerPorts`), cómo los sirve cada tecnología
(`memoryLedgerPorts: Bindings<LedgerPorts>`; `postgresLedgerPorts(pool)` cuando llegue) y lo
que sirve (`{ handlers?, security?, cors? }`). `Ports` es la intersección de esos slices y un
puerto nuevo sin proveer no compila. Un perfil (`profiles/local.ts`) es un despliegue: compone
una tabla de enlaces por módulo con `binder(overrides).bind(...)`; nunca elige gateways por su
cuenta (`arch`: `profiles-compose-modules`).
`bootstrap(config, { profile?, modules?, ports?, handlers? })` devuelve `{ app, ports, close }`; el
logger es un puerto (`Logger` en `shared-kernel`, pino en `infrastructure/logging/`) y las
pruebas lo reemplazan por `ports.logger`. `start()` adjunta el ciclo de vida (`lifecycle.ts`):
SIGINT/SIGTERM cierran en orden y salen 0; un cierre que falla o excede la gracia, una excepción
no capturada o una promesa rechazada sin manejar se loguean y salen 1. `readConfig` rechaza con
`ConfigError` (variable + problema) lo que no puede arrancar el servidor; `bootstrap` se niega
a arrancar si el contrato declara una operación que ningún módulo sirve. Las pruebas usan
`startTestApp()` de `tests/helpers/test-app.ts` (dos merchants fijos, reloj reemplazable).
Los merchants viven detrás del puerto `MerchantStore` (ADR-031; en memoria hasta la feature de
persistencia): `OPE_MERCHANTS` (JSON) o `OPE_MERCHANTS_FILE` es una **semilla** que
`bootstrap` importa por `ImportMerchantsUseCase` como el operador `system` sólo si el store
arranca vacío (con merchants ya registrados, no pisa nada); sin semilla ni store poblado, nadie
autentica. Nada de lo que un operador hace a un merchant (crear, rotar, apagar, dar de baja)
requiere reiniciar: se lee del store en la siguiente request. Los dos niveles del release
(constitución XI, ADR-031) son archivos del repositorio, `config/platform.json` y
`config/treatment-defaults.json` (`OPE_PLATFORM_CONFIG` / `OPE_TREATMENT_DEFAULTS` nombran
otros), que `readConfig` lee por los lectores de forma del módulo `configuration`
(`readPlatformConfiguration`, `readTreatmentDefaults`) y las fábricas del dominio
(`PlatformConfiguration.of`, `TreatmentDefaults.of`) juzgan: un valor fuera de rango es un
`ConfigError` que nombra `platform.<campo>` o `treatmentDefaults.<campo>`. La semilla admite,
junto a los campos del merchant, todo lo que `MerchantConfigurationDeclared` admite
(`decisionPolicy`, `commercialPolicy`, `evidenceProfile`, `holdoutPercent`, `freshness`, …):
`bootstrap` lo publica como la versión 1 del merchant (`ImportMerchantConfigurationUseCase`,
operador `system`) sólo si el merchant no tiene versiones. No hay servidor mock ni modo
(ADR-018): el composition root no decide sobre configuración (`shape` regla 5).

### Cómo se escribe un caso de uso (ADR-023, verificado por `lint` y `arch`)

- Un archivo `src/application/<módulo>/use-cases/<nombre>.use-case.ts` que exporta **una** clase
  `<Nombre>UseCase implements UseCase<Request, Response>` con `execute(request)`. Lo que cambia
  por llamada va en el request; lo que necesita para operar llega por el constructor como un
  único objeto tipado por una interfaz `<Nombre>Dependencies` del mismo archivo, cuyos campos
  son interfaces (puertos de `ports/`, servicios `*Service`, `Clock`, `Logger`),
  **seis como máximo** (`ope/dependencies-are-interfaces`). Superarlo se resuelve extrayendo un
  servicio, no relajando el límite.
- Un caso de uso **nunca** importa ni invoca a otro caso de uso (`use-cases-no-use-cases`). Lo
  compartido que necesita puertos es una interfaz `*Service` con implementación
  `Default*Service` en `services/` (la asignación: `AssignmentService`); un servicio no importa
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
- Preocupaciones transversales: un `UseCase<I, O>` que envuelve otro, en
  `application/shared-kernel/decorators/` (`LoggedUseCase`: nombre, duración y `ok` o `code`,
  nunca el request), aplicado en `composition/modules/<módulo>.ts`.
- Cada regla `ope/*` vive en `scripts/lint/<regla>.mjs` (plugin `scripts/lint/plugin.mjs`) con su
  fixture en `tests/lint/fixtures/as-src/` y las de arquitectura en
  `tests/architecture/fixtures/src/`.

### Cómo se escribe una entidad (ADR-024, verificado por `lint`)

- **Clase si hay reglas, tipo si no.** Un concepto con invariantes o comportamiento
  (`EventBatch`, `Decision`, `Experiment`, `Merchant`, `Origin`) es una clase en
  `src/domain/<módulo>/<concepto>.ts` con `private constructor`, `static of(...)` que devuelve
  `Result<T, E>` con los errores de su `errors.ts` (si tenés la instancia, es válida) y
  `static rehydrate(record)` que reconstruye desde datos ya registrados **sin** reevaluar las
  reglas de creación. Un valor sin reglas (`Exposure`, `Assignment`, ids, `Arm`, `ServiceHealth`)
  sigue siendo un tipo; no se envuelve por uniformidad.
- **Las reglas viven con su dueño y se invocan por su nombre**: `experiment.assign(visitorId)`,
  `merchant.allowsOrigin(origin)`, `decision.isIntervention()`, `batch.noOpReason()`. Un caso de
  uso o servicio no reimplementa una regla del dominio. `src/domain/` no exporta funciones
  sueltas (`ope/domain-no-loose-functions`); la excepción declarada son las primitivas del
  `shared-kernel` (`ok`/`fail`, `seconds`/`minutes`/`hours`) y los constructores de identidad
  de cada módulo (`ids.ts`).
- **Estados ilegales irrepresentables**: `Decision` es `NoOpDecision | InterveneDecision`
  (discriminada por `outcome`; `NO_OP` lleva un `NoOpReason` del catálogo, `INTERVENE` su
  intervención). Fábricas `NoOpDecision.of` / `InterveneDecision.of`; `DecisionBase.rehydrate`.
- **Las invariantes se validan en su dueño; nadie las esquiva.** `composition/config.ts` parsea
  la forma del JSON y construye por fábrica; un `fail` es un `ConfigError` que nombra el campo
  (`merchants[i].experiments[j].treatmentPercent`, `merchants[i].origins[k]`). Los gateways
  reciben entidades, nunca registros crudos. Los errores de configuración son `DomainError` y
  figuran en el catálogo de problemas aunque ningún endpoint los emita.
- **Convención de tasas dentro del dominio**: `Experiment.treatmentShare` y
  `CommercialPolicy.{maxIncentiveShare, incentiveLadderShare, marginShare}` son 0–1; el
  porcentaje entero 0–100 existe sólo en `OPE_MERCHANTS` (`treatmentPercent`,
  `maxIncentivePercent`, …) y en el DTO (`Incentive.value`, lo que el comprador ve). El reparto
  resuelve a buckets enteros (1 %) y el incentivo a un porcentaje entero (`Math.round`), una vez
  en el dominio; `isRate`/`isCount` del `shared-kernel` juzgan los números.
- **Políticas publicadas en el contrato** (la ventana de deduplicación) se declaran en
  dominio o aplicación (`application/ingestion/policies/`) y el gateway las recibe.
- **Todo puerto devuelve `Promise`**; los gateways en memoria devuelven `Promise.resolve(...)`.
- La guarda de instantes no parseables (`NaN`) vive en la traducción DTO → dominio del
  controller (error de programación), no en el dominio.

### Gates de calidad (ADR-016, verificado por `quality` y `test:mutation`)

- Forma del código en el lint (`eslint-plugin-sonarjs` + core): complejidad cognitiva ≤ 15,
  anidamiento ≤ 3, ≤ 4 parámetros, ≤ 60 líneas por función (apagada en `tests/`), sin funciones ni
  ramas idénticas, sin `catch` que ignore el error; números mágicos sólo con nombre en `src/` (0, 1,
  −1 e índices exceptuados); strings repetidos sin tipar sólo con nombre en `src/`
  (`ope/no-magic-strings`, regla propia con tipos en `scripts/lint/`); forma de casos de uso,
  dependencias y errores (`ope/use-case-shape`, `ope/dependencies-are-interfaces`,
  `ope/domain-error-shape`, `ope/no-throw-domain-error`, `ope/no-generic-catch-in-application`,
  ADR-023); dominio sin funciones sueltas (`ope/domain-no-loose-functions`, ADR-024). Cada umbral lleva su justificación en `eslint.config.mjs`; los bloques
  por alcance (`SHAPE_RULES`, `SRC_ONLY_RULES`, `APPLICATION_RULES`, `USE_CASE_RULES`,
  `DOMAIN_RULES`, `DOMAIN_ERROR_RULES`, `TEST_ONLY_RULES`) se exportan para las pruebas.
- Duplicación: ≥ 5 líneas / 50 tokens iguales en `src/` no entran. Código muerto: `knip.json`
  lista las entradas y las exclusiones; los motivos están en el encabezado de
  `scripts/check-dead-code.mjs` (knip no admite comentarios).
- Mutación: un cambio no entra si un mutante de sus propias líneas sobrevive. `StringLiteral`
  está excluido (prosa; los literales tipados ya son errores de compilación al mutarse). El
  runner lleva `patches/@stryker-mutator+vitest-runner+10.0.0.patch` hasta que stryker-js#6210
  se publique; `patch-package` lo aplica en `postinstall` y falla si deja de aplicar.
- Forma de los anillos (`scripts/shape-rules.mjs`, `tests/architecture/shape.test.ts`): ≤ 300
  líneas por archivo en `domain/` y `application/`; un controller por `operationId`; ningún `new`
  de un paquete npm fuera de `composition/`, `infrastructure/` y los gateways; ningún `import()`
  calculado; ninguna condición sobre `config.<campo>` en `composition/` (salvo `config.ts`);
  ningún carácter de control crudo en el fuente (un separador como U+001F se escribe como su
  escape, nunca como el carácter).
- Excepciones: en línea y con motivo, como las de lint (`Lint exceptions: N`); en mutación,
  `// Stryker disable next-line <mutador>: <motivo>`.
- **Cómo se trabaja el gate de mutación** (la corrida completa cuesta minutos; no se repite por
  cada arreglo): el archivo incremental `reports/mutation/stryker-incremental.json` **no se
  borra** — la segunda corrida re-testea sólo lo que cambió; `--all` escribe en otro archivo y
  nunca alimenta al gate. Ante un superviviente, en este orden: (1) describir el daño observable
  del mutante; (2) clasificarlo — real, equivalente, sólo diagnóstico, específico del runner —
  antes de tocar nada; (3) si es real, la prueba que pasa con el original y falla con el mutante;
  si es equivalente, reestructurar el código para que el mutante no exista, no una excepción;
  (4) confirmar con `npm run test:mutation -- --files <archivo>[:l1-l2]` (un minuto), no con la
  corrida completa. La corrida completa del gate la hace **CI en cada push** (job propio): es el
  juez; localmente no se espera. Un mutante **estático** (código que corre fuera de un `it`: carga
  de módulo, `beforeAll` → `bootstrap`, semilla, lectores de configuración) se ignora
  (`ignoreStatic`, ADR-016 enmendado 2026-09-21): el runner de Vitest no lo activa de forma fiable
  y da falsos sobrevivientes; si además lo cubre un test, sigue corriendo contra ese test. Nunca
  se cambia producción sólo para satisfacer la herramienta.
- **Ritmo de las pruebas, en dos velocidades** (decisión del dueño, 2026-09-21): por historia,
  local y en minutos — `format:check`, `typecheck`, `quality`, `npm test` (proyecto `fast`) — y
  commit. Por hito — el cierre de la feature (antes de la PR) y cada push de la rama — CI corre
  todo: `contract:check`, `quality`, `test:scoped` (el proyecto `tools` sólo cuando el cambio
  toca una herramienta), `test:contract`, `release-check` y `test:mutation` en su job. Ante un
  sobreviviente en CI, `test:mutation -- --files <archivo>` local (un minuto), nunca la corrida
  completa. La `--all` informativa y `test:load` son medidas de tendencia para hitos más gruesos
  (varias features, un piloto), no gates.

### Tipado (ADR-011, ADR-012, ADR-017; verificado por `lint` y `typecheck`)

- Compilador: TypeScript 7 (`@typescript/native`) ejecuta `build` y `typecheck`; `typescript` es
  el alias de `@typescript/typescript6` (API 6.0) que importan typescript-eslint,
  openapi-typescript y dependency-cruiser, hasta que admitan la API ≥ 7.1 (ADR-017).

- Sin `any` explícito ni valores `any` (`no-unsafe-*`), sin `!`, promesas siempre manejadas,
  `switch` exhaustivo, imports de tipo con `type`. El borde con una librería que expone `any`
  se lee como `unknown` y se estrecha (ver `infrastructure/http/dispatch.ts`, `tests/helpers/json.ts`).
- Una excepción va **en la línea**, con motivo: `// eslint-disable-next-line <regla> -- <motivo>`.
  Sin motivo o sin uso, falla. Objetivo permanente: `Lint exceptions: 0`.
- Scripts JavaScript (`scripts/`, `contracts/rules/functions/`) se verifican con `checkJs`:
  toda función exportada lleva su firma en JSDoc; los valores desconocidos se leen con
  `prop()`/`isObject()`; los tipos compartidos son `@typedef` importables (`@import`).
- `erasableSyntaxOnly`: sin `enum` ni parámetros de propiedad; uniones de literales y campos
  explícitos. `noPropertyAccessFromIndexSignature`: `env["PORT"]`, no `env.PORT`.
- Formato: Prettier, y nada más. `npm run format` antes de commitear; el hook lo verifica.

### Notas operativas del contrato

Lo descriptivo —qué es cada entrada de `contracts/`, las convenciones del multi-archivo, la
tabla de extensiones `x-*` (dónde, forma, regla, consumidor) y cómo se agrega una operación, un
esquema, un tipo de problema, un motivo de `NO_OP`, una regla o un ejemplo— vive en
`contracts/README.md` (verificado por `tests/docs`: toda extensión de la fuente tiene su fila).
Acá queda lo normativo:

- Ruleset de Spectral en estilo bloque (no `{ a: b }`), `"off"` entre comillas.
  `oas3-schema` está apagada por un bug con path items `$ref` en 3.1; la estructura la
  valida Redocly. Detalle en `specs/001-api-contract-toolchain/research.md` (R-02).
- Lista de datos personales prohibidos: **sólo** `contracts/rules/pii-denylist.json`.
- Catálogo de tipos de error: `contracts/problem-types.yaml` (`urn:ope:problem:<slug>`),
  **generado** a `generated/problem-types.{js,d.ts}` por `contract:types` (una sola fuente, sin
  réplica; `ProblemSlug` y los status son literales) y re-exportado por
  `interface-adapters/http/problem-details.ts`.
  Catálogo de motivos de `NO_OP`: `contracts/no-op-reasons.yaml`, replicado en
  `src/domain/shared-kernel/no-op-reasons.ts` (vocabulario compartido por ingesta, ledger y
  decisión; string con patrón, no enum: ampliar es compatible). Barreras (`BARRIERS`) y
  anclajes (`ANCHORS`) también viven en el kernel, con réplica contra el contrato.
- Uniones discriminadas (`Event`): `type: object` + `oneOf` + `discriminator` **con `mapping`**
  y `type: { enum: [valor] }` en cada rama (sin `const`). Ajv no acepta `mapping` y sólo aplica
  el discriminador a objetos: el servidor lo quita en runtime
  (`infrastructure/http/strip-discriminator-mappings.ts`) y el `type: object` es obligatorio.
  Sólo el subconjunto de JSON Schema que OpenAPI 3.0 admite (ADR-014).
- **Ledger (ADR-021, ADR-023)**: todo `record()` devuelve `Result<…, LedgerUnavailable>`;
  ningún puerto lanza por indisponibilidad. La ingesta degrada a `NO_OP` `ledger-unavailable`
  (202, sin registrar); la exposición responde `503` con `Retry-After`. El camino se prueba con
  los ledgers falsos de `tests/helpers/unavailable-ledgers.ts`.
- **Puerto de plataforma y estrategia de sincronización (constitución X, ADR-025)**: cada
  flujo (catálogo, stock/precio, órdenes, devoluciones) llega por uno de tres modos negociados
  con el merchant —`push` (construido: la plataforma empuja), `pull` (OPE consulta su API),
  `subscribe` (OPE consume su cola)— y los tres entran por el mismo puerto; los adaptadores
  viven en OPE, desacoplados del núcleo, y agregar una plataforma es agregar un adaptador. Los
  modos `pull`/`subscribe`, el refresco parcial de stock/precio, el planificador, el consumidor
  y los adaptadores Magento 2 y de prueba son la feature "Platform port, per-flow sync strategy
  and adapters" del mapa (`contracts/api-map.yaml`). Todo Constitution Check evalúa los once
  principios y cita la versión de la constitución.
- **Verdad de producto (ADR-025)**: el catálogo entra como snapshot completo por
  `PUT /v1/catalog` (consumidor `platform`); `capturedAt` es la clave de idempotencia (201 crea,
  200 repite, 409 conflicto, 422 fuera de orden). `CatalogSnapshot` (dominio `catalog`) sólo
  existe válido; `ProductTruthService` (aplicación) responde `known` con frescura por clase
  (`FreshnessBudget` del dominio `catalog`; los presupuestos son defaults de tratamiento en
  `config/treatment-defaults.json` — catálogo 36 h, stock/precio 15 min desde `capturedAt` —
  que el merchant sobrescribe en su versión y el servicio lee por el puerto `CatalogPolicies`)
  o `unknown` con motivo, y `syncLevel` observado (`SyncLevelRules.observe`, 0–2; 3 nunca con
  snapshots completos; los umbrales y las recepciones conservadas son defaults de tratamiento,
  la mediana es el algoritmo). El stock es guardia: `available` booleano, sin cantidades.
  `Money` vive en el `shared-kernel` del dominio.
- **Plano de decisión (ADR-026, ADR-027)**: la ingesta no conoce al plano: `IngestBatchUseCase`
  invoca el puerto `DecisionPlane` (`application/ingestion/ports/`) que implementa
  `DecisionService` (`application/decision/services/`) y la composición enlaza
  (`decisionPlaneOf(ports)` en `modules/decision.ts`). El orquestador recorre las cinco
  autoridades: asignación → inferencia (`barrier`) → evidencia (`catalog`) → selección + quality
  gate (`selection`) → política comercial (`commercial`, la única que emite el veredicto) →
  ledger (`DecisionRecorder`, que acuña el id y degrada a `ledger-unavailable`). La inferencia es
  pura: `Signals` (monoide: el lote se funde con la sesión) y `BarrierRules.infer` devuelven la
  confianza de las **tres** barreras; `DecisionPolicy.barrierVerdict` elige la dominante (umbral,
  prioridad) y juzga su evidencia por barrera. `CANDIDATES` (vocabulario cerrado por barrera en
  orden de escalera, con claims) pasa por `QualityGate.of(profile).judgeAll`: el primer claim sin
  evidencia de su clase rechaza el candidato entero; `CommercialPolicy.verdict` elige el escalón
  más bajo (uno más con abandono que confirma la barrera, D-B; el reaseguro cuando el abandono
  la puso en la mesa; incentivo directo en `price`), bloquea (`margin-missing`,
  `incentive-not-allowed`, `return-risk`), aplica alta intención, presupuesto por sesión,
  cooldown y fatiga por visitante. Las tres políticas del merchant —`decisionPolicy`
  (inferencia), `commercialPolicy` (techo, escalones, margen, riesgo de devolución, alta
  intención, abandono, presupuestos) y `evidenceProfile` (qué declara poder sostener)— son
  defaults de tratamiento (`config/treatment-defaults.json`: `default-1`,
  `commercial-default-1` sin margen ⇒ sin incentivos, perfil vacío) que la versión del merchant
  sobrescribe **campo por campo** (una política declarada nombra su versión y sólo lo que
  cambia); la forma la leen los lectores de `application/configuration/input/` (semilla, archivo
  y API por igual), las invariantes el dominio (`PolicyInput`, `TreatmentValues`). El plano lee
  `PolicyDirectory` (`PolicySet`: políticas, `barriers` activas, `versions`) que la composición
  enlaza al servicio de configuración; sólo las barreras activas pueden ser dominantes. Ambas
  políticas son parte del experimento. El vocabulario de hechos
  y de candidatos es cerrado: un hecho, un claim o un candidato nuevo es una feature. Cada
  decisión registra `inference`, `selection` (candidatos con veredicto del gate, elegido,
  veredicto comercial, `commercialPolicyVersion`) y el `locale` de la página en foco
  (`PageContext.locale`, BCP 47 validado por forma, para el catálogo de mensajes); el DTO del SDK sólo lleva `outcome`, `reason`
  (barrera si `INTERVENE`) e `intervention` (`msg_<barrera>_<anclaje>_<escalón>_v0` hasta el
  catálogo de mensajes, más `incentive { kind: percent, value }` cuando la política lo concede). Estado de sesión
  y de visitante en memoria (`SessionStateStore`, `VisitorStateStore`, ventanas de 24 h); una
  intervención cuenta contra los presupuestos sólo si el ledger la aceptó.
- **Outcomes y cadena de evidencia (ADR-028)**: el módulo `outcomes` (`[shared-kernel, ledger]`)
  recibe lo que la plataforma y el SDK dicen de las compras. `POST /v1/orders` (`platformKey`,
  mecanismo A de 02 §5.1) registra la orden como venta verificada con lo que 01 §10.3 admite
  (`Order.of`: SKUs sin repetir, confirmación no futura); la **correlación es sólo por A**:
  `Correlation.of(sessionId, decisions)` con `DecisionLedger.bySession` — una sesión es conocida
  si el merchant decidió en ella; hereda `experiment { experimentId, arm }` de sus decisiones —
  y sin ella queda `PENDING_CORRELATION`, nunca completada por inferencia; la orden es inmutable
  (reenviarla "corregida" es `409`). **Idempotencia atómica en el puerto**: `OrderLedger.record`
  y `recordReturn` deciden `recorded | repeated | conflict` dentro del gateway (01 §6: sin
  `await` entre chequeo y escritura) con `sameContentAs` sobre lo que la plataforma envió
  (ítems por SKU, instantes de recepción y lo derivado ignorados). `POST /v1/orders/corroborations`
  (`ingestKey`, mecanismo B) es evidencia unida a la orden por `merchantId/orderId`: nunca crea ni
  atribuye. `POST /v1/returns` marca `RETURNED` conservando la correlación (`order-unknown`,
  `return-items-not-in-order`; una devolución por orden). La orden puede declarar `incentive` y
  `IncentiveRedemption.of` lo cruza con la última intervención con incentivo de la sesión
  (`matched | mismatched | not-applied | not-granted | unverifiable`), sin rechazar nunca. Todo
  `record()` devuelve `Result<…, LedgerUnavailable>` ⇒ `503` con `Retry-After`. Las respuestas
  llevan `status` (la cadena de 01 §5: `VERIFIED_ORDER | ATTRIBUTED_ORDER | RETURNED`;
  `Order.status()`) y `correlation` (`PENDING_CORRELATION | ATTRIBUTED`;
  `Order.correlationStatus()`), y nunca brazo, experimento ni visitante. Lo que comparten los controllers al borde sin conocer un módulo (`instantOf`, `idempotent`, paginación)
  vive en `http/boundary.ts`; lo que conoce el módulo (`linesOf`) en `outcomes/presenters.ts`; nunca en `controllers/` (un archivo allí es una operación).
- **Merchants operados (ADR-031, feature 017)**: `Merchant` (dominio) lleva `status`
  (`active | off | deactivated`) y `credentials: Credential[]` (`kind` `ingest | platform |
signing`, huella SHA-256 del valor, `issuedAt`, `expiresAt`; sólo la de firma conserva el
  secreto). Las reglas viven en el agregado: `owns(fingerprint, now)`, `ownsPlatformKey`,
  `signingSecrets(now)`, `requiresSignature(now)`, `rotated(credential, grace, now)` (la anterior
  sigue valiendo durante la gracia, acotada por un máximo), `switched(on)`, `deactivated()`
  (irreversible; `409 merchant-deactivated`), `Merchant.judgeOrigins`. Los valores de las
  credenciales los acuña el puerto `CredentialMinter` (`ope_ik_ | ope_pk_ | ope_ps_` + base64url)
  y viajan **una sola vez** en la respuesta que los emite; el store guarda huellas
  (`MerchantDirectory.byFingerprint`). Kill switch (01 §14.2): `switched(false)` ⇒ la decisión
  responde `NO_OP` `merchant-off` **antes** de asignar (`MerchantPolicies.enabled`, leído del
  store por `switchAwarePolicyDirectory`); ingesta, outcomes y catálogo siguen. Operadores:
  `OPE_ADMIN_OPERATORS` (JSON) o `OPE_ADMIN_OPERATORS_FILE` (`operatorId`, huellas de sus
  tokens, `scope: "*" | [merchantId]`); `adminToken` es bearer (`Authorization: Bearer
ope_at_…`), `DefaultAdminTokenResolver` lo resuelve por huella (`401 operator-unknown`) y
  entrega `OperatorPrincipal` (`operatorOf(req)`); un merchant fuera del alcance responde `403
merchant-out-of-scope` con el mismo cuerpo que uno inexistente sólo cuando el operador no lo
  alcanza (`DefaultScopedMerchantService.find`). Toda operación `admin` se envuelve en
  `AuditedUseCase` (`composition/modules/admin.ts`): el registro de administración
  (`AdminLog`, `AdminEntry`: operador, operación, merchant, resultado `accepted | rejected |
failed`, motivo) se escribe pase o falle; `GET /v1/admin/log` y `GET
/v1/admin/merchants/{merchantId}/log` lo leen paginado (`Page`/`PageQuery` del kernel de
  aplicación, `pageOf` en `interface-adapters/shared-kernel/`, `pageQueryOf`/`pageDto`/`merchantPageResponse` en `http/boundary.ts`).
  `node scripts/mint-admin-token.mjs` acuña un token y su huella; `config/dev-operators.json`
  lleva el operador de desarrollo. `merchantId` de la ruta se lee con `merchantIdOf(req)`
  (`http/boundary.ts`), la única ruta donde figura (constitución V); el DTO del merchant y la
  respuesta de rotación viven en `merchant/presenters.ts`, los del registro y el diagnóstico en
  `admin/presenters.ts`.
- **Firma de plataforma (ADR-029)**: los secretos de firma son credenciales `signing` del merchant
  (uno o dos vigentes, ≠ claves; en la semilla, `OPE_MERCHANTS[i].platformSecrets`;
  `Merchant.requiresSignature(now)`). Con secreto, toda operación con `platformKey` (catálogo,
  órdenes, devoluciones) exige `X-OPE-Timestamp` y `X-OPE-Signature` (`v1=` + hex HMAC-SHA256 de
  `<ts>.<bytes crudos>`), ventana ±5 min (`application/merchant/policies/signature-window.ts`),
  cualquiera de los secretos; `401 signature-missing | signature-invalid | signature-expired`
  antes de validar el body. La infraestructura conserva los bytes del JSON (`keepRawBodies` en
  `infrastructure/http/raw-bodies.ts`: parser `parseAs: "buffer"` que delega al parser de Fastify) y los entrega a
  los security handlers como `SecurityRequest.rawBody`; `PlatformSignature` (dominio) parsea,
  compara en tiempo constante y juzga la ventana; el HMAC va detrás del puerto
  `MessageAuthenticator` (`node:crypto` en `interface-adapters/merchant/gateways/`). Toda operación con
  `platformKey` declara los dos parámetros de header (regla `ope-platform-signature-headers`).
  `node scripts/sign-platform-request.mjs <secreto> <archivo>` firma para curl e Insomnia.
- **Asignación y experimentos (ADR-022, ADR-024, ADR-031; 03 §4.10, D-G)**: un experimento lo
  abre un operador (`POST /v1/admin/merchants/{merchantId}/experiments`: `treatmentPercent`,
  `seed`, `targetSample`, `cuts` crecientes como porcentajes de la muestra) y nace
  `calibrating`: se asigna y se decide, pero cada decisión estampa `phase: calibration` y la
  configuración sigue publicándose. `activate` lo pasa a `active` (`activatedAt` =
  `windowStartedAt`) y **congela** la configuración: sólo entra una versión `corrective` con
  `reason`, que reinicia la ventana (`windowRestarts[]` con la versión y el motivo;
  `PublishMerchantConfigurationUseCase` la registra por `ExperimentStore.update` y el registro
  de administración lleva `windowRestarted`). `close` es terminal (`closed`; repetir es 200;
  reactivar es `409 experiment-not-open`). Como máximo uno abierto por merchant
  (`Experiments.of` ⇒ `409 experiment-already-open`, juzgado dentro del store); el reparto no
  puede tomar el holdout efectivo del merchant (`Experiment.withinHoldout` ⇒ `422
treatment-exceeds-holdout`, leído por el puerto `HoldoutSource`). El interruptor no cambia su
  estado. Las reglas viven en `Experiment` (`activated`, `closed`, `windowRestarted`,
  `isOpen`, `phase`); el id lo acuña `ExperimentIdMinter` (`exp_` + base32). La semilla
  (`OPE_MERCHANTS[i].experiments[]`: `experimentId`, `treatmentPercent`, `seed`,
  `targetSample`, `cuts?`, `status`, `openedAt`) entra por `ImportExperimentsUseCase` sólo
  con el store vacío y sin juzgar el holdout; un `active` de la semilla arranca su ventana en
  `openedAt`. `Experiment.assign` es pura (FNV-1a privado del dominio, `treatmentShare` 0–1,
  regresión con fingerprint de la 007) y no depende del estado; la asignación se registra con el
  primer lote aceptado del experimento abierto (`ExperimentDirectory.activeFor`); CONTROL
  resuelve `NO_OP` `control-arm`; sin experimento abierto, `no-active-experiment`. El brazo,
  el experimento y la fase **nunca** viajan como campos: sólo el motivo del `NO_OP` sale al SDK.
- **Configuración del SDK y diagnóstico de anclajes (01 §3.1.1; feature 017)**: `GET
/v1/sdk/config` (`ingestKey`, `config:read`) devuelve lo que el SDK puede ver del merchant de
  su credencial —`enabled` (interruptor), `versions`, `surfaces`, `locales`, `anchors?`— y
  nunca una política, margen, escalón, reparto, brazo ni experimento; `Cache-Control: no-store`.
  Lo sirve el módulo `admin` por el puerto `SdkConfigurationSource` (`sdkConfigurationOf` en
  `modules/configuration.ts`) y el merchant llega resuelto por el security handler
  (`GetSdkConfigUseCase` recibe la entidad y lee `isOn()`). `POST /v1/sdk/diagnostics`
  (`diagnostics:write`) recibe anclajes no resueltos (`anchor` del vocabulario, `pageType`,
  `configurationVersion?`; nada de la página ni de la persona) y `AnchorDiagnosticsStore.upsert`
  conserva por merchant el último instante y un contador por clave, con tope
  `anchorDiagnosticsKept` de plataforma (se descarta el más viejo, nunca se rechaza); `GET
/v1/admin/merchants/{merchantId}/anchor-diagnostics` lo lee paginado. `PageType` es un esquema
  propio compartido por `PageContext` y los diagnósticos.
- Operación autenticada con la credencial de ingesta ⇒ `security: [{ ingestKey: [] }]`; con
  la de plataforma (servidor a servidor, `X-OPE-Platform-Key`, ADR-025) ⇒ `security: [{
platformKey: [] }]`; de un operador (`Authorization: Bearer`, ADR-031) ⇒ `security: [{
adminToken: [] }]`. El security handler resuelve el merchant antes de validar el body (401 /
  403 `origin-not-allowed`) y entrega las capacidades de su consumidor
  (`http/security/capabilities.ts`, réplica del mapa); la infraestructura compara
  `x-required-capabilities` y responde `403 capability-missing` si falta alguna. Cada esquema
  declara su header en el cableado (`SecurityScheme { handler, header }`): CORS los deriva de
  ahí y el log redacta todo header. Los logs nunca llevan IP, headers ni cuerpo
  (`request-logging.ts`). `bodyLimit` del servidor: 32 MiB (un snapshot de catálogo).
- Cambio incompatible ⇒ `info.version` a la mayor siguiente **y** prefijo `/v<N>/`. Excepción
  declarada (ADR-003): mientras el contrato lleve `info.x-stability: building` (ningún merchant
  lo consume), entra con bump MINOR y el prefijo se conserva; `contract:diff` lo reporta y lo
  acepta, `release-check` avisa. La marca se quita antes del primer piloto.
- Todo schema de un media type es `$ref` a `components/schemas` (nunca inline).
- `x-invariants` sobre la operación (si depende de otro recurso) o sobre el schema (si sólo
  involucra sus campos): `type` (slug del catálogo, nunca `unprocessable`), `status`, `rule`,
  `description`. Toda `422` nombra en su ejemplo la invariante que la produce.
- Operación autenticada ⇒ `x-required-capabilities: [recurso:accion]`; pública ⇒ sin él. El
  vocabulario de capacidades es cerrado por consumidor (`consumers.<x>.capabilities` del mapa).
- **Consumidores (ADR-020)**: el tag fija el consumidor (`system` → público; `ingest`,
  `decision` → SDK con `ingestKey`; `outcomes` → plataforma con `platformKey`; `portal` →
  `portalSession`; `admin` → `adminToken`) y `ope-consumer-security` exige exactamente ese
  esquema. Los esquemas y componentes que ninguna operación construida usa (`portalSession`,
  `adminToken`, parámetros de paginación, `Page`) existen como archivos en
  `components/` **sin referencia desde la raíz** (Redocly rechaza componentes sin uso); entran
  a la raíz con su primera operación.
- Operación `outcomes` (notificación servidor a servidor) ⇒ `x-idempotency: { key, first,
repeat }` (clave = propiedad requerida del body; dos 2xx distintos) y respuesta `409
idempotency-conflict`. Lectura de colección del portal (`GET` sin parámetro final) ⇒
  `x-collection: true`, parámetros `cursor`/`limit`/`from`/`to` por `$ref` y `200` con un
  `<X>Page` (`items`, `nextCursor?`).
- `merchantId` en la ruta sólo bajo el consumidor `admin` (constitución V v1.2.0, ADR-020); en
  query y body, nunca.
- Ciclo de vida (ADR-019): depreciar = `deprecated: true` en la operación + estado `deprecated`
  en el mapa + anuncio en la descripción; retirar = quitar del contrato + `retired` con
  `retiredIn` + versión mayor. La documentación publicada muestra la superficie planeada
  generada desde el mapa (`contract:docs`).

### Documentación viva

- **Sin cifras de estado en prosa viva** (cuántas reglas, pruebas, operaciones, términos): se
  desactualizan y nadie las corrige. Las informan `contract:check`, `npm test` y
  `check:markers`. Las tablas de estado de `specs/*/quickstart.md` son históricas y fechadas.
- Decisiones transversales en `docs/adr/` (citar `ADR-NNN`); el `research.md` de una feature
  las cita y conserva la evidencia.
- Lo no resuelto se marca con `ABIERTO`, `PROPUESTO` o `PLACEHOLDER` dentro del texto al que
  pertenece; `release-check` no pasa con `ABIERTO` ni `PLACEHOLDER`. Lo abierto del MVP
  (D3–D6) vive en ADR-010, no como marcador del contrato.
- **Todo directorio de primer nivel que no es código lleva `README.md` con inventario**
  (ADR-032): una tabla `## Inventario` que nombra cada entrada (qué es, fuente o derivado, quién
  lo lee, verificación; columnas propias donde la prueba las exige) y sin cifras de estado.
  `tests/docs/readmes.test.ts` (proyecto `tools`; política en `scripts/readme-inventory-lib.mjs`)
  falla con un README ausente, una entrada sin fila, una fila sin entrada o un directorio nuevo
  sin política; también exige la cabecera de generados (`GENERATED by scripts/<x>.mjs`, y `<x>`
  existe), de parches (`# Fix:`, `# Retire:`) y de scripts (comentario inicial). Lo normativo
  queda en este archivo; lo descriptivo, en el README de cada directorio.

### Auditoría de arquitectura (ADR-032)

La skill `auditing-architecture` vive en el plugin `plugins/auditable-architecture/` (habilitado
por `.claude/settings.json`; marketplace en `.claude-plugin/marketplace.json`) y es sólo el
método: lo que es de este repo está en `audit.profile.json` (alcances, gates, fuentes de verdad
con su severidad, criterios, evals). Los gates hablan el protocolo `findings-v1` por los
adaptadores de `scripts/audit/gate-*.mjs`; agregar un gate es un adaptador y una línea en el
perfil; agregar una fuente de verdad, una línea en `sources[]`. Los criterios de diseño están en
`docs/auditoria/criterios-diseno.md`; las evaluaciones propias en `tests/audit/evals/` (las
universales viajan con el plugin). El plugin no importa nada del repo por ruta
(`tests/audit/plugin-isolation.test.ts`).

## Reglas que fallan el build (no son sugerencias)

- `merchantId` nunca en path, query ni body: se deriva de la credencial. Única excepción: en
  la ruta de las operaciones del consumidor `admin` (ADR-020; constitución V, v1.2.0).
- Ningún campo de dato personal en ningún esquema (lista en el ruleset de lint).
- Todo request body con `additionalProperties: false`.
- Todo error es RFC 9457 Problem Details.
- Cambio incompatible del contrato ⇒ nueva versión mayor, o falla (salvo contrato marcado
  `building`, ADR-003: se acepta y se reporta).
- Cero llamadas a modelos de lenguaje en runtime.
- Sin I/O de red ni escritura bloqueante en el camino crítico de decisión.
- Toda feature que toca persistencia o API incluye pruebas de aislamiento entre merchants.

## Convenciones

- **Ninguna política vive en el código (constitución XI, ADR-031)**: todo valor que gobierna
  el comportamiento es configuración en tres niveles —plataforma (`config/platform.json`:
  ventana de deduplicación, tolerancia de reloj, memoria de sesión y visitante, ventana de
  firma, gracia máxima de rotación, tope de diagnósticos), default de tratamiento
  (`config/treatment-defaults.json`: frescura, umbrales del nivel de sincronización,
  `holdoutPercent`, las tres políticas, superficies, barreras, estrategia de sincronización,
  idiomas) y merchant (versiones publicadas por `publishMerchantConfiguration`, más el mapa de
  anclajes)— resuelta valor por valor por `EffectiveConfiguration` y servida desde memoria por
  `ConfigurationService`; cada decisión estampa la terna (`DecisionFacts.configuration`). El
  código conserva invariantes y algoritmos; las constantes ya salieron (`check:behaviour-constants`
  vigila que no vuelvan): un valor de comportamiento nuevo es una entrada en un nivel, nunca una
  constante. Los consumidores reciben los valores por su puerto (`ClockTolerance`,
  `SignatureWindow`, `CatalogPolicies`, `PolicyDirectory`, `VisitorWindow`) o en su construcción
  (los stores en memoria reciben su ventana), enlazados en `composition/modules/`.
- TypeScript `strict`. Sin `any`. Un módulo por autoridad. Composition root único en
  `src/composition/` (ADR-013). Identificadores como tipos marcados (`Branded`): una identidad
  vive en `src/domain/shared-kernel/ids.ts` **sólo** si la comparten módulos que no pueden
  depender entre sí (`MerchantId`, `SessionId`, `VisitorId`, `ExperimentId`); con un dueño, vive
  en su módulo (`DecisionId` en `ledger/ids.ts`, `EventId` en `ingestion/ids.ts`). Quien acuña
  un id lo pide por un puerto del dueño (`DecisionIdGenerator` del ledger), nunca al kernel.
- Porcentajes 0–100 sólo en el borde (DTO); adentro, tasas 0–1.
- Literales de la plataforma (señales, métodos, headers, media types, claves reservadas de una
  librería) se declaran una vez, con nombre y tipo (`HTTP_METHODS`, `SHUTDOWN_SIGNALS`); un
  literal repetido en `src/` donde alguna ocurrencia no la verifica un tipo literal falla el
  lint (`ope/no-magic-strings`). Donde el tipo es una unión de literales (`ProblemSlug`,
  `NodeJS.Signals`) el literal se queda: el compilador es la constante.
- `NO_OP` es un resultado válido con motivo, nunca una excepción. Un error de negocio es un
  `DomainError` devuelto en un `Result`, nunca lanzado (ADR-023).
- Marcar afirmaciones como `DECIDIDO` / `PROPUESTO` / `ABIERTO` y estado del sistema como
  **BUILT / CONNECTED / ACTIVE / TESTED**. No afirmar que algo funciona sin prueba ejecutable.
- Commits: conventional commits, en español, un cambio por commit. No commitear sin que las
  pruebas pasen. No hacer push sin que el usuario lo pida.

## Si existe `HANDOFF.md` en la raíz

Leerlo primero: contiene el estado de la tarea en curso. Borrarlo cuando la tarea que describe
esté terminada y commiteada.
