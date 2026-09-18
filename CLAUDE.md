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
   `src/interface-adapters/http/controllers/<módulo>/<operacion>.ts` tipado con
   `OperationHandler<"<operationId>">` (sólo traduce DTO ↔ request/response; lee el merchant con
   `merchantOf(req)`; un fallo se responde con `toProblem(result.error, req.instance)`), gateway
   del puerto en `src/interface-adapters/gateways/<módulo>/`, y
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

| Comando                                           | Qué hace                                                                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run contract:lint`                           | Redocly (estructura) + Spectral (`contracts/.spectral.yaml`, reglas `ope-*`)                                                                 |
| `npm run contract:bundle`                         | Bundle en `contracts/dist/openapi.yaml` (derivado, no se commitea)                                                                           |
| `npm run contract:diff`                           | Cambios incompatibles contra `origin/main` (oasdiff); `CONTRACT_BASE_REF` para otra base                                                     |
| `npm run contract:types` / `contract:types:check` | Regenera `src/interface-adapters/http/generated/api.d.ts` / falla si está desactualizado                                                     |
| `npm run contract:check`                          | lint → bundle → diff → drift de tipos. Corre antes de cualquier commit                                                                       |
| `npm run contract:docs`                           | `docs/api/index.html` autocontenido; se rehúsa si `contract:check` falla                                                                     |
| `npm run contract:insomnia`                       | `docs/api/insomnia.json`: colección de Insomnia derivada del bundle (un request por operación, header de credencial, instantes vivos)        |
| `npm run build` / `dev` / `typecheck`             | `tsc` a `dist/` / servidor real en memoria con `config/dev-merchants.json` (sin mock, ADR-018) / `tsc --noEmit`                              |
| `npm test`                                        | Vitest: unitarias, integración (`fastify.inject`), reglas del contrato, compatibilidad, gobernanza, arquitectura                             |
| `npm run test:contract`                           | Schemathesis (`uvx`) contra el servidor levantado                                                                                            |
| `npm run arch`                                    | dependency-cruiser sobre `src/`: dirección de dependencias entre capas (ADR-006)                                                             |
| `npm run check:invariant-tests`                   | Toda `x-invariants` del contrato tiene su prueba `[invariant:<slug>]`                                                                        |
| `npm run check:glossary`                          | Todo sustantivo del contrato resuelve a `docs/dominio/`; toda nota con fuente                                                                |
| `npm run check:adrs`                              | Frontmatter de `docs/adr/` y ninguna cita `ADR-NNN` rota                                                                                     |
| `npm run check:markers`                           | Lista `ABIERTO` / `PROPUESTO` / `PLACEHOLDER`; `-- --strict` falla con bloqueantes                                                           |
| `npm run check:api-map`                           | Mapa del contrato ↔ contrato en los dos sentidos; consumidores, capacidades, esquemas, features, fuentes, ciclo de vida                      |
| `npm run check:language`                          | Texto en español en comentarios, strings, contrato, configs o CI (lista `scripts/language-denylist.json`)                                    |
| `npm run format` / `format:check`                 | Prettier: formatea todo / falla si algo difiere del formato canónico (único formateador, ADR-011)                                            |
| `npm run lint` / `lint:fix`                       | ESLint estricto con tipos + conteo de excepciones (`Lint exceptions: N`) / arregla lo automático                                             |
| `npm run release-check`                           | `contract:check` + marcadores en modo estricto: la puerta antes de publicar                                                                  |
| `npm run check:duplication`                       | jscpd: clones estructurales; bloquea en `src/`, informa en `tests/` y `scripts/`                                                             |
| `npm run check:dead-code`                         | knip: archivos, exports y dependencias sin uso bloquean; tipos exportados sin uso informan                                                   |
| `npm run quality`                                 | `lint` → `arch` → `check:duplication` → `check:dead-code` → `check:language`; se detiene en el primero rojo                                  |
| `npm run test:load`                               | Carga informativa con autocannon sobre el servidor construido (`OPE_LOAD_DURATION`, `_CONNECTIONS`, `_VISITORS`); nunca falla por las cifras |
| `npm run test:mutation`                           | Stryker sobre las líneas de `src/` cambiadas contra `origin/main`; `-- --all` muta todo, informativo                                         |

Los cinco `check:*` de gobernanza corren dentro de `contract:check`; `quality` encadena los gates de calidad (ADR-016).

### Anillos y módulos (ADR-013, verificado por `npm run arch`)

`src/` contiene `main.ts`, `composition/` y cuatro anillos; nada más. Dependencia sólo hacia
adentro:

| Anillo                    | Qué va ahí                                                                                             | Puede importar de                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `src/domain/`             | reglas y valores puros, por módulo                                                                     | sólo `domain/`. **Nada de npm ni de Node, ni tipos**                                                  |
| `src/application/`        | casos de uso y **los puertos que definen** (`<módulo>/ports/`), por módulo                             | `domain/`, `application/`. Tampoco npm ni Node                                                        |
| `src/interface-adapters/` | `http/` (controllers, security, tipos generados, cliente) y `gateways/<módulo>/` (implementan puertos) | `application/`, `domain/`, npm. Un gateway no importa otro gateway; un controller no importa gateways |
| `src/infrastructure/`     | frameworks y drivers: Fastify + openapi-backend, CORS, logging                                         | todo menos `composition/` y `main.ts`                                                                 |
| `src/composition/`        | `Ports` (intersección de slices), perfiles, `modules/<módulo>.ts` (se cablea solo), `bootstrap()`      | todo; sólo `main.ts` y las pruebas lo importan. Controllers y casos de uso sólo desde `modules/`      |
| `src/main.ts`             | lee configuración, `bootstrap`, señales                                                                | `composition/` y Node; nadie lo importa                                                               |

**Módulos** dentro de `domain/` y `application/`: `shared-kernel`, `system`, `merchant`,
`ledger`, `experiment`, `ingestion`, `catalog` (los demás cuando llegue su feature). Dentro de un módulo
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
`ConfigError` (variable + problema) lo que no puede arrancar el servidor
y, en modo real, falla si el contrato declara una operación que ningún módulo sirve; las pruebas usan `startTestApp()` de
`tests/helpers/test-app.ts` (dos merchants fijos, reloj reemplazable). Merchants por
`OPE_MERCHANTS` (JSON) o `OPE_MERCHANTS_FILE`; sin ninguno, nadie autentica. No hay servidor
mock ni modo (ADR-018): el composition root no decide sobre configuración (`shape` regla 5); un
contrato con una operación que ningún módulo sirve no arranca.

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
  `interface-adapters/http/to-problem.ts` (`type` desde `code`, status y título del catálogo,
  headers por código como `Retry-After`); sólo el adaptador HTTP la importa
  (`problem-translation-only-in-http`). Los controllers no construyen errores.
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
- **Convención de tasas dentro del dominio**: `Experiment.treatmentShare` es 0–1; el porcentaje
  0–100 existe sólo en `OPE_MERCHANTS`. El reparto resuelve a buckets enteros (1 %).
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

### Tipado (ADR-011, ADR-012, ADR-017; verificado por `lint` y `typecheck`)

- Compilador: TypeScript 7 (`@typescript/native`) ejecuta `build` y `typecheck`; `typescript` es
  el alias de `@typescript/typescript6` (API 6.0) que importan typescript-eslint,
  openapi-typescript y dependency-cruiser, hasta que admitan la API ≥ 7.1 (ADR-017).

- Sin `any` explícito ni valores `any` (`no-unsafe-*`), sin `!`, promesas siempre manejadas,
  `switch` exhaustivo, imports de tipo con `type`. El borde con una librería que expone `any`
  se lee como `unknown` y se estrecha (ver `build-server.ts`, `tests/helpers/json.ts`).
- Una excepción va **en la línea**, con motivo: `// eslint-disable-next-line <regla> -- <motivo>`.
  Sin motivo o sin uso, falla. Objetivo permanente: `Lint exceptions: 0`.
- Scripts JavaScript (`scripts/`, `contracts/rules/functions/`) se verifican con `checkJs`:
  toda función exportada lleva su firma en JSDoc; los valores desconocidos se leen con
  `prop()`/`isObject()`; los tipos compartidos son `@typedef` importables (`@import`).
- `erasableSyntaxOnly`: sin `enum` ni parámetros de propiedad; uniones de literales y campos
  explícitos. `noPropertyAccessFromIndexSignature`: `env["PORT"]`, no `env.PORT`.
- Formato: Prettier, y nada más. `npm run format` antes de commitear; el hook lo verifica.

### Notas operativas del contrato

- Ruleset de Spectral en estilo bloque (no `{ a: b }`), `"off"` entre comillas.
  `oas3-schema` está apagada por un bug con path items `$ref` en 3.1; la estructura la
  valida Redocly. Detalle en `specs/001-api-contract-toolchain/research.md` (R-02).
- Lista de datos personales prohibidos: **sólo** `contracts/rules/pii-denylist.json`.
- Catálogo de tipos de error: `contracts/problem-types.yaml` (`urn:ope:problem:<slug>`),
  replicado en `src/interface-adapters/http/problem-details.ts` y verificado por prueba.
  Catálogo de motivos de `NO_OP`: `contracts/no-op-reasons.yaml`, replicado en
  `src/domain/shared-kernel/no-op-reasons.ts` (vocabulario compartido por ingesta, ledger y
  decisión; string con patrón, no enum: ampliar es compatible).
- Uniones discriminadas (`Event`): `type: object` + `oneOf` + `discriminator` **con `mapping`**
  y `type: { enum: [valor] }` en cada rama (sin `const`). Ajv no acepta `mapping` y sólo aplica
  el discriminador a objetos: el servidor lo quita en runtime
  (`infrastructure/http/strip-discriminator-mappings.ts`) y el `type: object` es obligatorio.
  Sólo el subconjunto de JSON Schema que OpenAPI 3.0 admite (ADR-014).
- **Ledger (ADR-021, ADR-023)**: todo `record()` devuelve `Result<…, LedgerUnavailable>`;
  ningún puerto lanza por indisponibilidad. La ingesta degrada a `NO_OP` `ledger-unavailable`
  (202, sin registrar); la exposición responde `503` con `Retry-After`. El camino se prueba con
  los ledgers falsos de `tests/helpers/unavailable-ledgers.ts`.
- **Verdad de producto (ADR-025)**: el catálogo entra como snapshot completo por
  `PUT /v1/catalog` (consumidor `platform`); `capturedAt` es la clave de idempotencia (201 crea,
  200 repite, 409 conflicto, 422 fuera de orden). `CatalogSnapshot` (dominio `catalog`) sólo
  existe válido; `ProductTruthService` (aplicación) responde `known` con frescura por clase
  (`application/catalog/policies/freshness.ts`: catálogo 36 h, stock/precio 15 min desde
  `capturedAt`) o `unknown` con motivo, y `syncLevel` observado (`policies/sync-level.ts`, 0–2;
  3 nunca con snapshots completos). El stock es guardia: `available` booleano, sin cantidades.
  `Money` vive en el `shared-kernel` del dominio.
- **Asignación (ADR-022, ADR-024)**: experimentos en `OPE_MERCHANTS` (`experiments[]`: `experimentId`,
  `treatmentPercent`, `seed`, `status`, `startedAt`; como máximo uno activo). `Experiment.assign`
  es pura (FNV-1a privado del dominio, `treatmentShare` 0–1, regresión con fingerprint de la 007);
  la asignación se registra con el primer lote aceptado; CONTROL
  resuelve `NO_OP` `control-arm`; sin experimento, `no-active-experiment`. El brazo y el
  experimento **nunca** viajan como campos: sólo el motivo del `NO_OP` sale al SDK.
- Operación autenticada con la credencial de ingesta ⇒ `security: [{ ingestKey: [] }]`; con
  la de plataforma (servidor a servidor, `X-OPE-Platform-Key`, ADR-025) ⇒ `security: [{
platformKey: [] }]`. El security handler resuelve el merchant antes de validar el body (401 /
  403 `origin-not-allowed`) y entrega las capacidades de su consumidor
  (`http/security/capabilities.ts`, réplica del mapa); la infraestructura compara
  `x-required-capabilities` y responde `403 capability-missing` si falta alguna. Cada esquema
  declara su header en el cableado (`SecurityScheme { handler, header }`): CORS los deriva de
  ahí y el log redacta todo header. Los logs nunca llevan IP, headers ni cuerpo
  (`request-logging.ts`). `bodyLimit` del servidor: 32 MiB (un snapshot de catálogo).
- Cambio incompatible ⇒ `info.version` a la mayor siguiente **y** prefijo `/v<N>/`.
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

## Reglas que fallan el build (no son sugerencias)

- `merchantId` nunca en path, query ni body: se deriva de la credencial. Única excepción: en
  la ruta de las operaciones del consumidor `admin` (ADR-020; constitución V, v1.2.0).
- Ningún campo de dato personal en ningún esquema (lista en el ruleset de lint).
- Todo request body con `additionalProperties: false`.
- Todo error es RFC 9457 Problem Details.
- Cambio incompatible del contrato ⇒ nueva versión mayor, o falla.
- Cero llamadas a modelos de lenguaje en runtime.
- Sin I/O de red ni escritura bloqueante en el camino crítico de decisión.
- Toda feature que toca persistencia o API incluye pruebas de aislamiento entre merchants.

## Convenciones

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
