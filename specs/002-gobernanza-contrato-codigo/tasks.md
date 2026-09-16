# Tasks: Gobernanza del contrato y del código

**Input**: Design documents from `specs/002-gobernanza-contrato-codigo/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: exigidas por la spec (FR-050: un fixture por regla nueva) y por la constitución
(pruebas antes de código). Cada fase escribe primero los fixtures y la prueba, que fallan hasta
que la regla o el script existen.

**Organization**: por historia. Orden elegido para no romper la 001 a mitad de camino (plan →
"Diseño"): docs (US3) → reglas del contrato (US1, US5, capacidad de US4) → glosario (US2) →
capas (US4) → cierre.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Proyecto único, raíz `backend/`. Scripts en `scripts/*.mjs` (Node, multiplataforma), reglas en
`contracts/.spectral.yaml` + `contracts/rules/functions/`, assertions en `redocly.yaml`.

---

## Phase 1: Setup

- [ ] T001 Agregar a `package.json` los scripts `check:adrs`, `check:markers`, `check:glossary`, `check:invariant-tests`, `arch` (`node node_modules/dependency-cruiser/bin/dependency-cruiser.mjs --config .dependency-cruiser.cjs src`), `release-check` (`node scripts/release-check.mjs`), y extender `contract:check` con `&& npm run check:invariant-tests && npm run check:glossary && npm run check:adrs && npm run check:markers`. `dependency-cruiser@^18.3.1` ya está en devDependencies.
- [ ] T002 [P] Crear `scripts/governance-lib.mjs` con utilidades compartidas por los scripts nuevos: `walkFiles(dir, extensions, ignore)`, `parseFrontmatter(markdown) → { data, body }` (bloque `---` YAML con el paquete `yaml`), `readBundle(path)`, `report(problems, okMessage)` (imprime `  - archivo:línea: mensaje` y devuelve el exit code), y `stripBackticks(line)` (quita spans `` `…` `` para que los marcadores citados no cuenten).

---

## Phase 2: Foundational

- [ ] T003 Agregar a `contracts/.spectral.yaml` la carga del catálogo para las funciones nuevas: `functions: [+ invariants, noGeneric422, requiredCapabilities]`; todas las reglas nuevas con `severity: error` y `message: "{{error}}"`. Las definiciones concretas van en T014, T015, T023 (esta tarea deja el ruleset sintácticamente válido y `contract:lint` en verde).
- [ ] T004 [P] Actualizar el generador de fixtures de la 001 (`tests/contract-rules/fixtures/` — regenerar con un script en `tests/contract-rules/gen-fixtures.mjs`, ahora commiteado, para que los fixtures se puedan regenerar sin depender del scratchpad): el request body de `createThing` y todas las respuestas usan `$ref` a `components/schemas` (sin schemas inline, por US5) y `valid.yaml` sigue pasando todas las reglas de la 001. Ejecutarlo y verificar `npx vitest run tests/contract-rules` en verde.

**Checkpoint**: `npm run contract:check` y `npm test` en verde como al cierre de la 001.

---

## Phase 3: User Story 3 — Decisiones y marcadores (Priority: P2, va primero: sólo docs)

**Goal**: ADRs numerados con citas verificadas; marcadores contables; puerta de release.

**Independent Test**: `tests/governance/adrs.test.ts` y `tests/governance/markers.test.ts` en verde; `npm run check:adrs`, `npm run check:markers -- --strict` salen 0 sobre el repo.

### Tests

- [ ] T005 [P] [US3] Crear fixtures en `tests/governance/fixtures/adrs/`: `ok/` (dos ADRs válidos `001-a.md`, `002-b.md` y un `doc.md` que cita `ADR-001`), `cita-rota/` (un doc cita `ADR-009` inexistente), `frontmatter-incompleto/` (ADR sin `estado`), `numero-no-coincide/` (`003-x.md` con `numero: 4`), `estado-invalido/` (`estado: vigente`).
- [ ] T006 [P] [US3] Crear `tests/governance/adrs.test.ts`: ejecuta `node scripts/check-adrs.mjs --root <fixture>` con `execFile`; `ok` → exit 0 y salida con `sin citas rotas`; cada caso malo → exit 1 y salida que nombra el archivo y el problema (`ADR-009`, `estado`, `numero`, `vigente`).
- [ ] T007 [P] [US3] Crear fixtures en `tests/governance/fixtures/markers/`: `limpio/` (docs sin marcadores y uno con `` `ABIERTO` `` entre backticks y un frontmatter `estado: abierta`), `propuesto/` (un `PROPUESTO`), `bloqueante/` (un `ABIERTO` en un `.md` y un `PLACEHOLDER` en un `.yaml` bajo `contracts/`).
- [ ] T008 [P] [US3] Crear `tests/governance/markers.test.ts`: `node scripts/check-markers.mjs --root <fixture> [--strict]`; `limpio` → exit 0, `Marcadores: 0` (el backtick y el frontmatter no cuentan); `propuesto` → exit 0 sin `--strict` y **exit 0 con aviso** con `--strict`; `bloqueante` → exit 0 sin `--strict` listando `archivo:línea:texto` de ambos, exit 1 con `--strict`.

### Implementation

- [ ] T009 [US3] Crear `scripts/check-adrs.mjs`: `--root` (default repo). Lee `docs/adr/*.md` (excluye `README.md`): frontmatter con `numero` (entero = prefijo del archivo), `titulo`, `estado` ∈ {propuesta, aceptada, reemplazada, abierta}, `fecha` (`YYYY-MM-DD`), `fuente`; busca `ADR-(\d{3})` en `docs/**/*.md`, `specs/**/*.md`, `contracts/**/*.yaml`, `README.md`, `CLAUDE.md`, `.specify/memory/constitution.md` (los que existan bajo `--root`) y falla si el número no tiene archivo. Salida ok: `ADRs: N, sin citas rotas` (FR-021).
- [ ] T010 [US3] Crear `scripts/check-markers.mjs`: `--root`, `--strict`. Recorre `contracts/**/*.yaml`, `docs/**/*.md`, `README.md`, `CLAUDE.md`; por línea, quita spans entre backticks y omite líneas de frontmatter que empiecen con `estado:`; busca `\b(ABIERTO|PROPUESTO|PLACEHOLDER)\b`; imprime `archivo:línea: TOKEN — texto`; resumen `Marcadores: A abiertos, P propuestos, H placeholders`; con `--strict` y (A+H) > 0 sale 1 con `release-check: quedan marcadores bloqueantes`; con sólo P imprime `aviso: N PROPUESTO pendientes de aprobación` y sale 0 (FR-022, FR-023).
- [ ] T011 [US3] Crear `scripts/release-check.mjs`: ejecuta `npm run contract:check` (vía `npm_execpath` como en `contract-docs.mjs`) y luego `node scripts/check-markers.mjs --strict`; propaga el primer exit ≠ 0.
- [ ] T012 [US3] Crear `docs/adr/README.md` (cómo citar, estados, plantilla) y los ADRs `docs/adr/001-mapa-de-codigos-400-422.md`, `002-tipos-de-problema-urn.md`, `003-versionado-del-contrato.md`, `004-herramientas-del-contrato.md`, `005-mock-desde-el-servidor.md` migrando el contenido de `specs/001-api-contract-toolchain/research.md` (R-06, R-11, R-12, R-02/R-03/R-04, R-07) con `estado: aceptada`, `fecha: 2026-09-16`, `fuente: specs/001-api-contract-toolchain/research.md`; `006-capas-y-direccion-de-dependencias.md`, `007-invariantes-declaradas.md`, `008-glosario-con-fuente.md`, `009-marcadores-y-puerta-de-release.md` desde research.md de esta feature (`fuente: specs/002-gobernanza-contrato-codigo/research.md`, `estado: aceptada`); `010-decisiones-abiertas-del-mvp.md` (`estado: abierta`, D3–D6 con referencia a los documentos del MVP, sin usar el token `ABIERTO`). Editar `specs/001-api-contract-toolchain/research.md` para que R-06, R-11, R-12, R-02/03/04 y R-07 empiecen con "**Registrado como ADR-00N**" y conserven la evidencia (no se borra el research: es histórico).
- [ ] T013 [US3] Correr `npm run check:adrs` y `npm run check:markers -- --strict` sobre el repo: ajustar `CLAUDE.md` (los tres marcadores entre backticks) y cualquier `PROPUESTO`/`ABIERTO` residual en `contracts/` o `docs/` hasta que `--strict` salga 0. Correr `npx vitest run tests/governance` → verde.

**Checkpoint**: US3 completa; commit.

---

## Phase 4: User Story 1 — Invariantes declaradas y probadas (Priority: P1)

**Goal**: `x-invariants` verificadas (forma, catálogo, status), `422` sin genéricos, y una prueba por invariante.

**Independent Test**: fixtures de `ope-invariants` y `ope-no-generic-422` en `tests/contract-rules`; `tests/governance/invariant-tests.test.ts`; `contract:check` reporta cero invariantes sobre el contrato real.

### Tests

- [ ] T014 [P] [US1] Agregar al generador de fixtures (T004) y regenerar: `ope-invariants.missing-field.yaml` (invariante sin `rule`), `ope-invariants.unknown-type.yaml` (`type: no-existe`), `ope-invariants.status-mismatch.yaml` (`type: not-found`, `status: 422`), `ope-invariants.generic.yaml` (`type: unprocessable`), `ope-no-generic-422.generic-example.yaml` (operación con `422` cuyo ejemplo tiene `type: urn:ope:problem:unprocessable`), `ope-no-generic-422.undeclared.yaml` (`422` con ejemplo `type: urn:ope:problem:not-found` sin invariante que lo declare), y un fixture válido `valid-invariants.yaml` (operación con `x-invariants` `type: not-found` `status: 404` y `404` cuyo ejemplo nombra ese tipo; sólo tipos del catálogo real). Agregar `valid-invariants.yaml` a la lista `VALID` de `rules.test.ts`.
- [ ] T015 [P] [US1] Crear fixtures en `tests/governance/fixtures/invariant-tests/`: `ok/` (`bundle.yaml` con una invariante `type: not-found` y `tests/x.test.ts` con `it("[invariant:not-found] …")`), `missing/` (mismo bundle, test sin el marcador), `none/` (bundle sin invariantes, sin tests).
- [ ] T016 [P] [US1] Crear `tests/governance/invariant-tests.test.ts`: `node scripts/check-invariant-tests.mjs --bundle <f> --tests-dir <d>`; `ok` → 0 y `Invariantes: 1 declaradas, 1 con prueba`; `missing` → 1 y salida con `[invariant:not-found]` y `tests/`; `none` → 0 y `Invariantes: 0 declaradas`.

### Implementation

- [ ] T017 [P] [US1] Crear `contracts/rules/functions/_catalog.js`: `loadCatalog(context, relativeFile)` que lee `contracts/problem-types.yaml` relativo al ruleset (mismo mecanismo que `noPii.js`: `context.rule.owner.source`) con caché, y devuelve `Map<slug, {status, title, type}>`. El PII sigue leyendo su JSON; este módulo parsea sólo el catálogo YAML, de forma fija (`types:` con `slug`/`status`/`title`), línea a línea y documentado, porque el paquete `yaml` no está disponible dentro del bundle de funciones de Spectral.
- [ ] T018 [P] [US1] Crear `contracts/rules/functions/invariants.js` (`given: $`, resuelto): recorre el documento juntando `x-invariants` (operaciones y schemas), y por cada una: campos `type`, `status`, `rule`, `description` presentes y no vacíos; `type !== "unprocessable"`; `type` en el catálogo; `status === catálogo[type].status`. Mensajes: `"Invariante en <path>: falta <campo>."`, `"… el type '<t>' no está en contracts/problem-types.yaml; agregalo al catálogo o corregí el slug."`, `"… status <s> no coincide con el del catálogo (<c>)."`, `"… 'unprocessable' es genérico: declará un tipo propio para la regla."`.
- [ ] T019 [P] [US1] Crear `contracts/rules/functions/noGeneric422.js` (`given: $.paths[*][get,put,post,delete,patch,options,head,trace]`, resuelto): si la operación tiene `responses["422"]`, junta los `type` de `content["application/problem+json"].example` y `examples[*].value`; junta los slugs de `x-invariants` de la operación y del schema del request body (recursivo por `properties/items/allOf/anyOf/oneOf`); falla si no hay ejemplos, si alguno es `urn:ope:problem:unprocessable`, o si alguno no está entre las invariantes declaradas. Mensaje con la operación y el tipo.
- [ ] T020 [US1] Definir en `contracts/.spectral.yaml` las reglas `ope-invariants` (`given: "$"`, `function: invariants`, `functionOptions: { catalog: ./problem-types.yaml }`) y `ope-no-generic-422` (`function: noGeneric422`). Eliminar `contracts/components/responses/UnprocessableEntity.yaml`. Correr `npm run contract:lint` → verde con `contracts/`; `npx vitest run tests/contract-rules` → verde.
- [ ] T021 [US1] Crear `scripts/check-invariant-tests.mjs`: `--bundle` (default `contracts/dist/openapi.yaml`), `--tests-dir` (default `tests`); junta `x-invariants[].type` del bundle; recorre `**/*.test.ts` buscando `\[invariant:<slug>\]`; imprime `Invariantes: N declaradas, M con prueba`; por cada faltante: `falta una prueba con [invariant:<slug>] en <tests-dir>/**/*.test.ts (invariante declarada en <path>)` y sale 1 (FR-003). Correr `npx vitest run tests/governance/invariant-tests.test.ts` → verde y `npm run check:invariant-tests` → `Invariantes: 0 declaradas`.
- [ ] T022 [US1] Actualizar `tests/contract-rules/README.md` con las reglas nuevas y la convención `[invariant:<slug>]`; actualizar `specs/002-gobernanza-contrato-codigo/contracts/x-invariants.md` si algo cambió.

**Checkpoint**: US1 completa; commit.

---

## Phase 5: User Story 5 + capacidad por operación (Priority: P3 / parte de US4)

**Goal**: schemas de media type siempre `$ref` (Redocly); capacidad requerida en operaciones autenticadas (Spectral).

**Independent Test**: `tests/contract-rules/redocly.test.ts` y fixtures `ope-required-capabilities.*` en verde.

### Tests

- [ ] T023 [P] [US5] Crear `tests/contract-rules/redocly/` con `inline-request.yaml` (request body con schema inline), `inline-response.yaml` (respuesta 200 con schema inline) y `valid.yaml` (todo por `$ref`), más `tests/contract-rules/redocly.test.ts` que ejecuta `node node_modules/@redocly/cli/bin/cli.js lint <fixture> --config redocly.yaml --format json` y afirma: en los `inline-*` hay un problema con `ruleId === "rule/media-type-schema-ref"`, `severity === "error"` y `location[0].start.line` definido; en `valid.yaml`, ninguno con ese `ruleId`.
- [ ] T024 [P] [US4] Agregar al generador y regenerar: `ope-required-capabilities.missing.yaml` (operación con `securitySchemes` + `security: [{k: []}]` y sin `x-required-capabilities`), `ope-required-capabilities.empty.yaml` (array vacío), `ope-required-capabilities.bad-format.yaml` (`["Events Write"]`), `ope-required-capabilities.public.yaml` (`security: []` **con** `x-required-capabilities`), `ope-required-capabilities.inherited.yaml` (`security` sólo en el root, operación sin capacidad), y en `valid-invariants.yaml` (o un `valid-capabilities.yaml` en `VALID`) una operación autenticada con `x-required-capabilities: [things:write]` y `401` declarado.

### Implementation

- [ ] T025 [US5] Agregar a `redocly.yaml` la assertion `rule/media-type-schema-ref` (`subject: {type: MediaType, property: schema}`, `assertions: {ref: true}`, `severity: error`, mensaje en español con la corrección). Correr `npm run contract:lint` → verde; `npx vitest run tests/contract-rules/redocly.test.ts` → verde.
- [ ] T026 [US4] Crear `contracts/rules/functions/requiredCapabilities.js` (`given: $.paths[*][get,…]`, resuelto): calcula `authenticated` igual que `requiredErrorResponses.js` (security propio, si no root); si autenticada, exige `x-required-capabilities` array no vacío de strings que matcheen `^[a-z][a-z-]*:[a-z][a-z-]*$`; si pública, exige que **no** exista. Mensajes: `"La operación <id> está autenticada y no declara x-required-capabilities (capacidad <recurso>:<accion>)."`, `"… declara una capacidad con formato inválido '<c>'."`, `"… es pública (security: []) y no debe declarar x-required-capabilities."`. Definir `ope-required-capabilities` en `.spectral.yaml`. `npx vitest run tests/contract-rules` → verde.

**Checkpoint**: commit.

---

## Phase 6: User Story 2 — Glosario verificado (Priority: P1)

**Goal**: `docs/dominio/` con notas con fuente; `check:glossary` falla ante sustantivo huérfano, nota sin fuente, fuente inexistente o nota sin uso sin `uso`.

**Independent Test**: `tests/governance/glossary.test.ts` en verde; `npm run check:glossary` sale 0 sobre el repo.

### Tests

- [ ] T027 [P] [US2] Crear fixtures en `tests/governance/fixtures/glossary/`: cada caso con `bundle.yaml` + `dominio/` (+ `_tecnicos.json`) + opcional `mvp/`: `ok/` (ruta `/v1/widgets`, schema `WidgetResponse`, nota `widget.md` con `en: widget`, `fuente: constitucion#I`, y `constitucion.md` local con encabezado `## I`), `huerfano/` (ruta `/v1/gadgets` sin nota), `sin-fuente/`, `fuente-inexistente/` (`fuente: mvp:99-nada.md`, con `mvp/` presente y sin ese archivo), `sin-uso/` (nota `sobrante.md` sin `uso`, término ausente del contrato), `uso-declarado/` (igual, con `uso: pendiente` → pasa), `mvp-ausente/` (`fuente: mvp:01-x.md`, sin directorio `mvp/` → pasa con aviso).
- [ ] T028 [P] [US2] Crear `tests/governance/glossary.test.ts`: `node scripts/check-glossary.mjs --bundle <f> --glossary <d> --constitution <f> --mvp-docs <d>`; asserts por caso: `ok` → 0; `huerfano` → 1 y `gadgets`; `sin-fuente` → 1 y nombre de la nota; `fuente-inexistente` → 1 y `99-nada.md`; `sin-uso` → 1 y `sobrante`; `uso-declarado` → 0; `mvp-ausente` → 0 y `aviso`.

### Implementation

- [ ] T029 [US2] Crear `scripts/check-glossary.mjs` según research R-03: flags `--bundle`, `--glossary` (default `docs/dominio`), `--constitution` (default `.specify/memory/constitution.md`), `--mvp-docs` (default `process.env.OPE_MVP_DOCS ?? ".."`). Extrae sustantivos (segmentos de ruta partidos por `-`, sin `v1`/`{…}`; nombres de `components.schemas` sin sufijos `Request|Response|List|Create|Update`, partidos por camelCase); resuelve cada palabra o el compuesto contra `en` (minúsculas, sin `s`/`es` final) o `_tecnicos.json`; valida frontmatter (`es`, `en`, `contexto`, `estado`, `fuente`); verifica `fuente` (`constitucion#X` → encabezado que contenga `X` en la constitución; `mvp:archivo#X` → archivo bajo `--mvp-docs` si existe el directorio, si no aviso; ruta → existe); notas sin uso exigen `uso`. Salida ok: `Glosario: N términos, todos con fuente; M usados en el contrato`.
- [ ] T030 [US2] Crear `docs/dominio/README.md` (plantilla de nota, formatos de `fuente`, cómo ampliar `_tecnicos.json`), `docs/dominio/_tecnicos.json` con `{"terms": ["health","problem","details","error","errors","v1","request","response","list","create","update","pointer","message","status","type","title","detail","instance"]}`, y las seis notas semilla `merchant.md` (`es: merchant`, `en: merchant`), `evento.md` (`event`), `sesion.md` (`session`), `visitante.md` (`visitor`), `orden.md` (`order`), `decision.md` (`decision`), todas con `fuente: constitucion#VI` (o `#IX` para decisión), `estado: aprobado`, `uso: pendiente`, y la cita textual de la constitución en el cuerpo. Correr `npm run check:glossary` → 0; `npx vitest run tests/governance/glossary.test.ts` → verde.

**Checkpoint**: commit.

---

## Phase 7: User Story 4 — Capas y prueba de arquitectura (Priority: P2)

**Goal**: código en `domain/ports/adapters/handlers`, `main.ts` como único root, dependency-cruiser en `test` y CI, comportamiento intacto.

**Independent Test**: `tests/architecture/architecture.test.ts` en verde (0 violaciones en `src/`, violaciones detectadas en fixtures); suite de la 001 en verde sin cambiar aserciones.

### Tests

- [ ] T031 [P] [US4] Crear `tests/architecture/fixtures/src/` con violaciones deliberadas, un archivo por regla: `domain/bad-npm.ts` (`import { parse } from "yaml"`), `domain/bad-adapter.ts` (import de `../adapters/x/a.js`), `ports/bad-adapter.ts`, `adapters/x/bad-cross.ts` (import de `../y/b.js`), `adapters/x/bad-handlers.ts` (import runtime de `../../handlers/h.js`), `handlers/bad-adapter.ts` (import de `../adapters/x/a.js`), `client/bad-domain.ts`, `some/bad-main.ts` (import de `../main.js`), más los archivos "buenos" mínimos que esos imports necesitan (`adapters/x/a.ts`, `adapters/y/b.ts`, `handlers/h.ts`, `main.ts`, `domain/d.ts`).
- [ ] T032 [P] [US4] Crear `tests/architecture/architecture.test.ts`: usa la API `cruise` de `dependency-cruiser` con la configuración cargada desde `.dependency-cruiser.cjs` (vía `extractDepcruiseConfig` de `dependency-cruiser/config-utl/extract-depcruise-config`); (a) sobre `src/` → `summary.violations` vacío; (b) sobre `tests/architecture/fixtures/src/` → una violación por cada regla esperada (`domain-is-pure`, `domain-no-layers`, `ports-only-domain`, `adapters-no-cross`, `adapters-no-handlers`, `handlers-no-adapters`, `client-only-generated`, `nobody-imports-main`), cada una con `from` y `to` que nombren el archivo del fixture.

### Implementation

- [ ] T033 [US4] Crear `.dependency-cruiser.cjs` con las reglas de research R-06 (rutas `(^|/)src/…`), `tsConfig: { fileName: "tsconfig.json" }`, `tsPreCompilationDeps: "specify"`, `doNotFollow: node_modules`, `no-circular`, `no-orphans` (excepto `generated`), y la excepción nombrada `adapters-may-type-import-handlers-typed` (regla `allowed`/`forbidden` con `pathNot` para `src/handlers/typed.ts` con `dependencyTypes: ["type-only"]`). Verificar `npx vitest run tests/architecture` → la parte (b) en verde (las reglas atrapan las violaciones).
- [ ] T034 [US4] Crear la capa de dominio y puertos: `src/domain/health.ts` (`serviceHealth({ now, contractVersion })` → `{ status: "ok", contractVersion, timestamp: Date }`, tipo `ServiceHealth`; sin imports), `src/ports/clock.ts` (`export interface Clock { now(): Date }`), `src/adapters/clock/system-clock.ts` (`export const systemClock: Clock = { now: () => new Date() }`). Prueba unitaria `tests/unit/domain-health.test.ts` para `serviceHealth`.
- [ ] T035 [US4] Mover con `git mv`: `src/server/build-server.ts` → `src/adapters/http/build-server.ts`, `src/server/problem-details.ts` → `src/adapters/http/problem-details.ts`, `src/server/handlers.ts` → `src/handlers/typed.ts`; actualizar imports relativos (`../generated/api.js` → `../../generated/api.js`, etc.) y `src/handlers/health.ts` para que reciba `{ contractVersion, clock: Clock }`, llame `serviceHealth` y traduzca a DTO (`timestamp.toISOString()`); `src/main.ts` cablea `systemClock`. Sin cambiar ninguna respuesta HTTP.
- [ ] T036 [US4] Actualizar rutas de import en `tests/**` (`../../src/server/...` → nuevas rutas; `makeGetHealth({ contractVersion, now })` → `{ contractVersion, clock: { now } }`) **sin tocar aserciones**; actualizar `tests/contract/fixtures/health-203.ts` y `tests/types/*.test-d.ts`. Correr `npm run build && npm run typecheck && npm test && npm run test:contract` → verde; `npm run arch` → 0 violaciones; `curl` de quickstart 001 §3/§4 con las mismas respuestas (SC-003).
- [ ] T037 [US4] Agregar `npm run arch` a `.github/workflows/ci.yml` (después de `typecheck`) y `npm run release-check` como último paso.

**Checkpoint**: commit.

---

## Phase 8: Polish

- [ ] T038 [P] Actualizar `CLAUDE.md`: comandos nuevos en la tabla; sección "Capas" (qué puede importar qué, dónde va cada cosa nueva, `npm run arch`); sección "Invariantes" (`x-invariants` + `[invariant:<slug>]`); "Glosario" (una nota por término antes de usarlo en el contrato); "Decisiones" (ADR antes de decidir algo transversal; citar `ADR-NNN`); "Marcadores" (los tres, entre backticks, y `release-check`); regla "sin cifras de estado en prosa viva: las informan `contract:check`, `test`, `check:markers`" (FR-024). Quitar de CLAUDE.md las cifras existentes si las hubiera.
- [ ] T039 [P] Actualizar `README.md` (comandos nuevos, `docs/adr`, `docs/dominio`) y `.specify/memory/constitution.md` **sólo** en la sección "Flujo de desarrollo" agregando al Constitution Check el gate "¿Introduce una regla de negocio que el esquema no expresa? → `x-invariants` con prueba" y "¿Introduce un sustantivo nuevo en el contrato? → nota en `docs/dominio/`" (enmienda MINOR: versión 1.1.0, con Sync Impact Report).
- [ ] T040 Correr `quickstart.md` completo (§1–§7), medir `contract:check` (SC-002), y completar la tabla "Estado al cierre" con fecha, comandos y resultados; verificar SC-004 (cada decisión de la 001 localizable en `docs/adr/`) y SC-005 (`check:markers --strict` = 0 bloqueantes).
- [ ] T041 Marcar tareas, commit final de la feature (conventional commit en español).

---

## Dependencies & Execution Order

```
Fase 1 → Fase 2 → US3 (docs) → US1 (invariantes) → US5+capacidad → US2 (glosario) → US4 (capas) → Polish
```

- US3, US1, US5, US2 son independientes entre sí tras la Fase 2; el orden elegido minimiza
  conflictos de archivos (todas tocan `.spectral.yaml` o el generador de fixtures) y deja la
  reubicación del código (US4, la única que toca `src/`) para el final, con todo lo demás en
  verde.
- Fase 8 depende de todas.

### Parallel Opportunities

- Dentro de cada historia, todos los fixtures y pruebas marcados [P] a la vez; las funciones
  custom de Spectral (T017–T019) a la vez.
- T031 y T032 (arquitectura) pueden escribirse mientras se hace US2.

## Implementation Strategy

MVP = US3 + US1 (decisiones encontrables e invariantes probadas). Cada historia termina con
`npm run contract:check && npm test` en verde y un commit. US4 se hace en dos commits: (1)
configuración + fixtures + capas nuevas sin mover nada; (2) el movimiento con las pruebas en
verde, para que el diff de comportamiento sea revisable por separado.

## Notes

- Los fixtures de `tests/contract-rules/` se regeneran con `node tests/contract-rules/gen-fixtures.mjs`;
  no se editan a mano.
- Ninguna tarea escribe cifras de estado en `CLAUDE.md`/`README.md`; las tablas de
  `quickstart.md` son históricas y fechadas.
