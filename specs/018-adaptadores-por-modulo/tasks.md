# Tasks: Adaptadores por módulo

**Input**: Design documents from `/specs/018-adaptadores-por-modulo/`

**Prerequisites**: plan.md, spec.md, research.md (R-01..R-10), data-model.md, quickstart.md

**Tests**: no hay pruebas nuevas de comportamiento (FR-008: nada observable cambia). Las pruebas
de esta feature son las de arquitectura (un fixture por regla nueva, US2), las que se mueven
para espejar el árbol (US1) y las que cambian de ruta de import. Después de cada tarea que mueve
archivos: `npm run typecheck && npm test`.

**Organization**: por historia; dentro de US1, un bloque por módulo para que cada movimiento se
verifique solo (R-10). Commits de trabajo por bloque; al cerrar cada historia se agrupan en uno
(regla "un commit por historia") salvo indicación del dueño.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (archivos distintos, sin dependencia pendiente)
- **[Story]**: historia a la que pertenece (US1..US4)

## Path Conventions

Proyecto único: `src/`, `tests/`, `scripts/`, `generated/`, `client/` en la raíz del repo.

---

## Phase 1: Setup

- [x] T001 Línea base: en `main` mergeado (`94f38e9`) con `npm ci`, `npm run contract:bundle`, `npm test` (1 268) y `npm run quality` en verde; anotar en `specs/018-adaptadores-por-modulo/quickstart.md` § "Cambios respecto del plan" la cifra de partida (pruebas, archivos del anillo: 70)
- [x] T002 [P] Inventario ejecutable del anillo antes de mover: guardar `find src/interface-adapters -name "*.ts" | sort` en `specs/018-adaptadores-por-modulo/inventory-before.txt` para comparar al cierre (mismos archivos, otras rutas; ninguno perdido ni duplicado)

---

## Phase 2: Foundational — el núcleo `http/` sin módulos (R-02)

**Purpose**: repartir la raíz de `http/` antes de mover módulos, para que los controllers ya
importen del núcleo o de su propio `presenters.ts` cuando se muevan.

- [x] T010 Núcleo `src/interface-adapters/http/boundary.ts`: conserva `instantOf`, `idempotent`, `pageQueryOf`, `pageDto`; recibe `merchantIdOf` y `merchantPageResponse` (+ `MerchantPageRequest`) desde `admin-boundary.ts`; sale `linesOf` (va a `outcomes`, T011). Sólo importa `domain/shared-kernel`, `domain/operator` (tipo `Operator`), `application/shared-kernel`, `./security/principal.js`, `./to-problem.js`, `./status.js`
- [x] T011 [P] Presenters por módulo: `src/interface-adapters/outcomes/presenters.ts` (`linesOf`), `src/interface-adapters/merchant/presenters.ts` (`merchantDto`, `rotationResponse`), `src/interface-adapters/admin/presenters.ts` (`adminEntryDto`, `anchorDiagnosticDto`), `src/interface-adapters/configuration/presenters.ts` (todo `configuration-boundary.ts`), `src/interface-adapters/experiment/presenters.ts` (todo `experiment-boundary.ts`, `PERCENT`); borrar `admin-boundary.ts`, `configuration-boundary.ts`, `experiment-boundary.ts`; actualizar imports de los controllers (siguen en `http/controllers/<m>/` hasta US1) y de `tests/`
- [x] T012 Verificar: `npm run typecheck && npm test && npm run arch`; `ls src/interface-adapters/http` sin nombre de módulo salvo `controllers/` y `security/` (se vacían en US1). Commit de trabajo `refactor(018): la raíz de http/ se reparte entre el núcleo y los presenters de cada módulo`

**Checkpoint**: el núcleo ya no conoce ningún módulo de feature; los controllers importan del núcleo o de `<m>/presenters.ts`.

---

## Phase 3: User Story 1 — El anillo tiene la forma de los otros dos (Priority: P1) 🎯 MVP

**Goal**: `interface-adapters/<m>/{controllers/,presenters.ts,security/,gateways/,index.ts}` para los 12 módulos; composición por `index.ts`; `config.ts` partido; pruebas espejo (spec US1, escenarios 1–7).

**Independent Test**: quickstart § US1.

### Bloque por módulo (para cada uno: `git mv`, `index.ts`, composición, imports de pruebas, `typecheck` + `npm test`)

- [x] T020 [US1] `shared-kernel`: `git mv src/interface-adapters/gateways/shared-kernel/{paging,random-id,system-clock,windowed-map}.ts src/interface-adapters/shared-kernel/`; `index.ts` con `pageOf`, `randomId`, `systemClock`, `windowedMap`; imports en gateways y `composition/modules/shared-kernel.ts`
- [x] T021 [US1] `system`: `git mv http/controllers/system/get-health.ts src/interface-adapters/system/controllers/`; `index.ts` (`makeGetHealth`); `composition/modules/system.ts` importa `interface-adapters/system/index.js`
- [x] T022 [US1] `merchant`: controllers (8) → `merchant/controllers/`; `http/security/{ingest-key,platform-key}.ts` → `merchant/security/`; gateways (3) → `merchant/gateways/`; `index.ts` (fábricas `make*`, `INGEST_KEY_SCHEME`/`_HEADER`, `PLATFORM_KEY_SCHEME`/`_HEADER`, `makeIngestKeySecurity`, `makePlatformKeySecurity`, `memoryMerchantStore`, `nodeCredentialMinter`, `nodeMessageAuthenticator`); `composition/modules/merchant.ts` por `index.js`; pruebas `tests/unit/gateways/merchant/*` → `tests/unit/interface-adapters/merchant/`, `tests/unit/http/*` de seguridad → `tests/unit/interface-adapters/merchant/`
- [x] T023 [US1] `ledger`: `confirm-exposure.ts` → `ledger/controllers/`; gateways (3) → `ledger/gateways/`; `index.ts`; `composition/modules/ledger.ts`; pruebas → `tests/unit/interface-adapters/ledger/`
- [x] T024 [US1] `experiment`: controllers (4) → `experiment/controllers/`; gateways (3) → `experiment/gateways/`; `index.ts`; `composition/modules/experiment.ts`; pruebas
- [x] T025 [US1] `ingestion`: `ingest-events.ts` → `ingestion/controllers/`; `memory-event-dedup.ts` → `ingestion/gateways/`; `index.ts`; `composition/modules/ingestion.ts`; pruebas
- [x] T026 [US1] `catalog`: `upsert-catalog-snapshot.ts` → `catalog/controllers/`; `memory-catalog-store.ts` → `catalog/gateways/`; `index.ts`; `composition/modules/catalog.ts`; pruebas
- [x] T027 [US1] `decision`: gateways (3) → `decision/gateways/`; `index.ts`; `composition/modules/decision.ts`; pruebas (`switch-aware-policy-directory`, stores de estado)
- [x] T028 [US1] `outcomes`: controllers (3) → `outcomes/controllers/` (importan `linesOf` de `../presenters.js`); gateways (2) → `outcomes/gateways/`; `index.ts`; `composition/modules/outcomes.ts`; pruebas
- [x] T029 [US1] `configuration`: controllers (5) → `configuration/controllers/`; gateways (2) → `configuration/gateways/`; `index.ts`; `composition/modules/configuration.ts`; pruebas
- [x] T030 [US1] `admin`: controllers (5) → `admin/controllers/`; `http/security/admin-token.ts` → `admin/security/`; gateways (4) → `admin/gateways/`; `index.ts` (incluye `ADMIN_TOKEN_SCHEME`/`_HEADER`, `makeAdminTokenSecurity`); `composition/modules/admin.ts`; pruebas
- [x] T031 [US1] `barrier`: no tiene controllers ni gateways (su inferencia es un servicio de aplicación, `RuleBasedBarrierInference`): sin directorio en el anillo; anotar en quickstart que la forma admite un módulo sin adaptadores y que `composition/modules/barrier.ts` no importa nada del anillo
- [x] T032 [US1] Borrar `src/interface-adapters/http/controllers/` y `src/interface-adapters/gateways/` vacíos; `http/security/` queda con `principal.ts`, `capabilities.ts`, `headers.ts`; `grep -rn "interface-adapters/" src/composition/modules | grep -v index.js` vacío

### Composición y pruebas

- [x] T033 [US1] Partir `src/composition/config.ts` (R-08): `merchants-config.ts` (`parseMerchants`, `judgeSeed`, `declaredOf`, `FIELD_BY_CODE`, `rejected`), `experiments-config.ts` (`parseExperiments`, `parseExperiment`, `moved`, `isNumberArray`), `levels-config.ts` (`readLevels`); `config.ts` con `readConfig`, tipos y variables; `tests/unit/composition/config.test.ts` sin cambiar ningún mensaje esperado; crear `src/composition/adapters/README.md` (dos líneas: para qué está, vacío por diseño) o dejar el directorio fuera hasta que haga falta (decidir y anotar)
- [x] T034 [US1] `tests/unit/gateways/` y `tests/unit/http/` no existen; todo bajo `tests/unit/interface-adapters/<m>/` y `tests/unit/interface-adapters/http/`; `git status` muestra sólo renames (`R`) para los archivos movidos
- [x] T035 [US1] `scripts/shape-rules.mjs`: regla "un controller por operationId" recorre `interface-adapters/*/controllers/`; `MAY_INSTANTIATE` con `interface-adapters/*/gateways/`; fixtures `tests/architecture/fixtures/shape/{controllers,new-outside}/src/interface-adapters/…` a la forma nueva; `tests/architecture/shape.test.ts` en verde
- [x] T036 [US1] Gates de la historia: `npm run format:check && npm run typecheck && npm run quality && npm test`; `git diff main -- contracts/` vacío; comparar `inventory-before.txt` con el inventario nuevo por nombre de archivo (mismos 70 menos los borrados a propósito: `*-boundary.ts`, `client.ts` en US3); agrupar los commits de trabajo en `refactor(018): el anillo de adaptadores por módulo — entrada y salida por nombre, núcleo sin módulos, composición por index`

**Checkpoint**: la forma nueva completa, suite idéntica; todavía sin reglas que la vigilen.

---

## Phase 4: User Story 2 — La forma se vigila (Priority: P2)

**Goal**: cuatro reglas nuevas en `.dependency-cruiser.cjs` con fixture, las existentes reubicadas (spec US2, escenarios 1–7; R-03).

**Independent Test**: quickstart § US2.

- [x] T040 [US2] Fixtures primero en `tests/architecture/fixtures/src/`: mover `interface-adapters/{gateways,http}/…` a la forma nueva (`interface-adapters/a/gateways/{gateway-a,bad-cross,ok-shared-kernel}.ts`, `interface-adapters/b/gateways/gateway-b.ts`, `interface-adapters/c/gateways/bad-problem.ts`, `interface-adapters/shared-kernel/windowed.ts`, `interface-adapters/ledger/controllers/ok.ts`, `interface-adapters/x/controllers/{bad-gateway,bad-infra}.ts`, `interface-adapters/http/to-problem.ts`); agregar `interface-adapters/http/bad-module.ts` (importa `../ledger/index.js`), `interface-adapters/a/bad-context.ts` (importa `../b/index.js` sin permiso del mapa), `interface-adapters/a/bad-internal-import.ts` (importa `../b/gateways/gateway-b.js`), `interface-adapters/a/gateways/bad-driver.ts` (importa un paquete npm), `composition/modules/bad-deep-import.ts` (importa `interface-adapters/ledger/gateways/…` directo), `composition/adapters/ok-adapter.ts`; `index.ts` de `a`, `b`, `ledger` del fixture
- [x] T041 [US2] `.dependency-cruiser.cjs`: `MOD` = `(domain|application|interface-adapters)/` excluyendo `interface-adapters/http/` en `modules-only-via-index` y `contextRules`; reglas nuevas `adapters-core-knows-no-module`, `composition-imports-module-index`, `gateways-drivers-from-infrastructure` (npm prohibido, `node:` permitido), `generated-only-from-http-core` (preparada para US3: `dependencyTypes: ["aliased-subpath-import"]` con `to.path` `generated/`); rutas nuevas en `gateways-no-cross`, `controllers-no-gateways`, `profiles-compose-modules`, `composition-wires-by-module` (exime `composition/[a-z-]*config\.ts$`); comentario de cabecera con la forma del anillo
- [x] T042 [US2] `tests/architecture/architecture.test.ts`: lista de fixtures por regla ampliada con las cuatro nuevas y las rutas nuevas; "los legítimos no disparan nada" incluye `composition/adapters/ok-adapter.ts` e `interface-adapters/a/gateways/ok-shared-kernel.ts`; `npm run arch` limpio sobre `src/`
- [x] T043 [US2] `tests/audit/fixtures/*/src/` (`central-wiring-list`, `controller-instantiates-infra`, `profile-picks-gateways`, `hardcoded-profile`, `mode-flag-across-layers` si citan rutas) a la forma nueva; `.claude/skills/auditing-architecture/{scripts/run-gates.mjs,references/criterios-diseno.md,references/formato-hallazgo.md,evals/*/expected.json,evals/*/README.md}` con las rutas nuevas; `npm run test:tools` en verde
- [x] T044 [US2] Gates y commit `refactor(018): reglas de arquitectura del anillo — mapa de contextos, núcleo sin módulos, composición por index, drivers desde infraestructura`

**Checkpoint**: la forma es un invariante del build.

---

## Phase 5: User Story 3 — Lo derivado y lo ajeno salen de `src/` (Priority: P3)

**Goal**: `generated/{api.d.ts,problem-types.js,problem-types.d.ts}` por `contract:types`, réplica manual eliminada, `client/` fuera de `src/`, `Retry-After` en el nivel de plataforma (spec US3, escenarios 1–6; R-04..R-07).

**Independent Test**: quickstart § US3.

- [x] T050 [US3] Subpath imports: `package.json` `"imports": { "#generated/*": "./generated/*" }`; `git mv src/interface-adapters/http/generated/api.d.ts generated/api.d.ts`; `scripts/lib.mjs` (`generatedTypesPath` → `generated/api.d.ts`), `scripts/contract-types-lib.mjs` (comentario), `tests/unit/contract-types-check.test.ts`; imports `#generated/api.js` en `http/typed.ts`, `http/problem-details.ts`, `infrastructure/http/build-server.ts`, presenters y pruebas que usaban `client.ts`/`generated/api` para `components`; `tsconfig.typecheck.json` incluye `generated/` si hace falta para las pruebas; `npm run typecheck && npm test`
- [x] T051 [US3] Generador `scripts/contract-problem-types.mjs` (`checkJs`, JSDoc): lee `contracts/problem-types.yaml` con `readYaml`, emite `generated/problem-types.js` (`PROBLEM_NAMESPACE`, `PROBLEM_TYPES` congelado, orden del YAML, LF) y `generated/problem-types.d.ts` (declaración con literales, `ProblemSlug`); `contract:types` lo invoca tras los tipos; `contract:types:check` compara los tres artefactos; prueba en `tests/unit/contract-problem-types.test.ts` (determinismo, contenido igual al YAML, drift detectado)
- [x] T052 [US3] `src/interface-adapters/http/problem-details.ts` reducido: tipos del contrato, `PROBLEM_CONTENT_TYPE`, re-export de `#generated/problem-types.js`, `problem()`; borrar `tests/unit/problem-details.test.ts`; `tests/unit/domain/error-codes.test.ts` lee `ProblemSlug`/`PROBLEM_TYPES` de lo generado; `to-problem.ts` y `dispatch.ts` sin cambio de comportamiento; `npm test` con las mismas aserciones
- [x] T053 [US3] `Retry-After` al nivel 1 (R-06): `config/platform.json` `retryAfterSeconds: 5`; `PlatformConfiguration` lo juzga (entero ≥ 1) y `readPlatformConfiguration` lo lee; `contracts/components/schemas/PlatformConfiguration.yaml` lo declara (cambio aditivo bajo `building`; `contract:check`); `buildServer({ retryAfterSeconds })` y `infrastructure/http/dispatch.ts` agregan `retry-after` a toda `503` sin el header; `HEADERS_BY_CODE` y `LEDGER_RETRY_AFTER_SECONDS` desaparecen de `problem-details.ts`/`to-problem.ts`; `scripts/check-behaviour-constants.mjs` suma el nombre; pruebas de `ledger-unavailable`, `store-unavailable` y `admin-*` con `retry-after: 5` sin cambiar
- [x] T054 [US3] Cliente fuera de `src/` (R-07): `git mv src/interface-adapters/http/client.ts client/index.ts`; `tsconfig.client.json` (`rootDir: client`, `outDir: dist/client`, `include: ["client"]`); `package.json` `exports["./client"]` → `./dist/client/index.js` + `.d.ts`, `"build": "tsc -p tsconfig.json && tsc -p tsconfig.client.json"`, `"imports"` suma `"#client": "./client/index.ts"` para las pruebas; `tests/types/client.test-d.ts` y las 9 pruebas que importaban `components` de `client.ts` pasan a `#generated/api.js` o `#client`; `no-orphans` de `.dependency-cruiser.cjs` deja de exceptuar `client.ts`
- [x] T055 [US3] Exclusiones y marcas: `knip.json` (entry `client/index.ts`, ignore `generated/**`), `eslint.config.mjs`, `stryker.config.json`, `.prettierignore` (`generated/`), `.gitattributes` (`generated/** linguist-generated=true`); `npm run quality` sin excepción nueva; `ls src/interface-adapters/http | grep -c generated` = 0
- [x] T056 [US3] Gates y commit `refactor(018): lo derivado y lo ajeno salen de src — tipos y catálogo generados, cliente aparte, Retry-After en el nivel de plataforma`

**Checkpoint**: `src/` sólo tiene código escrito a mano; una sola fuente para el catálogo.

---

## Phase 6: User Story 4 — La decisión queda documentada (Priority: P4)

**Goal**: ADR-013 enmendado, CLAUDE.md al día, herramientas verificadas (spec US4, escenarios 1–3).

**Independent Test**: quickstart § US4.

- [x] T060 [US4] `docs/adr/013-*.md`: enmienda fechada 2026-09-21 con la forma del anillo por módulo (entrada y salida por nombre), el núcleo `http/` y su lista blanca, `generated/` y `client/` fuera de `src/`, las reglas nuevas, y las variantes evaluadas y descartadas (Onion, radical, fusión de archivos) con su motivo; `npm run check:adrs && npm run check:identifiers`
- [x] T061 [P] [US4] `CLAUDE.md`: tabla de anillos (fila de `interface-adapters` con la forma por módulo; `infrastructure/` como host y drivers), paso 4 de "feature que toca HTTP" con las rutas nuevas (`interface-adapters/<m>/controllers/<op>.ts`, `presenters.ts`, `security/`, `gateways/`, `index.ts`), § Composición (config partido, `adapters/`), § Notas operativas (catálogo generado en `generated/problem-types`, `contract:types` con dos artefactos, `Retry-After` en plataforma), tabla de comandos (`contract:types`), § "Cómo se escribe un caso de uso" (ruta de `to-problem`), toda cita a `gateways/<m>/` o `http/controllers/`
- [x] T062 [P] [US4] `README.md` si cita rutas del anillo o del cliente (`./client` del paquete); `docs/dominio/README.md` no cambia (no lista módulos del anillo)
- [x] T063 [US4] `specs/018-adaptadores-por-modulo/quickstart.md` § "Cambios respecto del plan" completo (decisiones tomadas en el camino, inventario antes/después, sobrevivientes de mutación si CI los reporta); commit `docs(018): ADR-013 enmendado, instrucciones y herramientas con la forma nueva del anillo`

---

## Phase 7: Cierre

- [x] T070 `npm run format:check && npm run quality && npm run typecheck && npm run test:all && npm run test:contract && npm run release-check` en verde; `npm run build` produce `dist/` y `dist/client/`; `npm run dev` arranca y responde `GET /v1/health`
- [x] T071 Push de la rama; CI: `checks` y el gate de mutación (archivos movidos: corrida larga, cero sobrevivientes esperados; ante uno, `test:mutation -- --files` local); PR `018-adaptadores-por-modulo` → `main` con el Constitution Check (once principios, v1.4.2) y SC-001..SC-006; sin merge hasta que el dueño lo pida

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 → US2 → US3 → US4 → Cierre.
- Phase 2 (núcleo) va antes que US1: los controllers deben importar del núcleo o de `presenters.ts` **antes** de moverse, para que cada bloque de US1 sea un `git mv` más imports.
- Dentro de US1: T020 (`shared-kernel`) primero (los gateways lo importan); T021–T031 en cualquier orden, un bloque por vez con verificación; T032–T036 al final.
- US2 después de US1: las reglas se escriben contra la forma final; sus fixtures (T040) antes que las reglas (T041).
- US3 después de US2: la regla `generated-only-from-http-core` se activa cuando `generated/` existe.
- T053 (`Retry-After`) toca el contrato (campo aditivo) y la plataforma: es la única tarea que cambia `contracts/`; `contract:check` en verde antes del commit de US3.

## Parallel Opportunities

- Phase 2: T011 (cinco `presenters.ts`) en paralelo tras T010.
- US1: T021–T031 son independientes entre sí (tras T020), pero se hacen de a uno para que la verificación señale el bloque culpable.
- US4: T060, T061 y T062 en paralelo.

## Implementation Strategy

MVP = Phase 2 + US1 (la forma). US2 la blinda; US3 saca lo derivado de `src/`; US4 cierra. Cada
historia deja todos los gates locales en verde y un commit; la PR se abre al cierre, sin merge.
