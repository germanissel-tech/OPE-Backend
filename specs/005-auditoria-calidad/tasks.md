# Tasks: Auditoría de calidad y arquitectura — gates deterministas, auditoría verificable e idioma del código

**Input**: Design documents from `specs/005-auditoria-calidad/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: exigidas por FR-051 (un caso que viola por regla y una prueba que confirma la
falla) y por FR-066 (tres escenarios de evaluación). Fixtures y pruebas se escriben antes de
la configuración que los hace pasar.

**Organization**: por historia, en el orden de implementación de research R-09 (que no es el
de prioridad de la spec): el compilador primero (US8) porque el lint con tipos y los tipos del
contrato dependen de su API; después el idioma (US1) para que cada archivo se toque una sola
vez; después los gates (US2–US6) y por último la skill (US7). Cada historia cierra con su
commit (o sus commits, donde el plan pide diffs separados) y con `npm run contract:check &&
npm run format:check && npm run lint && npm run typecheck && npm run arch && npm test` en
verde.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Proyecto único, raíz `backend/`. Configuraciones en la raíz; scripts de gobernanza en
`scripts/`; fixtures en `tests/<área>/fixtures/`; skill en
`.claude/skills/auditing-architecture/`.

---

## Phase 1: Setup

- [x] T001 Instalar devDependencies nuevas con `npm install -D`: `eslint-plugin-sonarjs@^4.2`, `jscpd@^5.2`, `knip@^6.36`, `@stryker-mutator/core@^10`, `@stryker-mutator/vitest-runner@^10`, `@stryker-mutator/typescript-checker@^10`, `patch-package@^8`, `@stoplight/spectral-parsers@^1.0` (hoy transitiva, importada en `tests/contract-rules/rules.test.ts`). Correr `npm update` para `openapi-backend`, `cross-env` y `tsx` (dentro de rango, R-10). Commitear `package-lock.json`.
- [x] T002 Agregar a `package.json` los scripts: `check:language` (`node scripts/check-language.mjs`), `check:duplication` (`node scripts/check-duplication.mjs`), `check:dead-code` (`node scripts/check-dead-code.mjs`), `quality` (`node scripts/quality.mjs`), `test:mutation` (`node scripts/mutation-diff.mjs`), `postinstall` (`patch-package`; lefthook ya se instala por su propio postinstall — verificar que no se pise). `check:language` se suma a `contract:check` en T017, cuando el script exista.
- [x] T003 [P] Ampliar `.prettierignore` (lista única, FR-004) con `scripts/language-denylist.json`, `tests/audit/fixtures/`, `tests/architecture/fixtures/shape/`, `tests/governance/fixtures/language/`, `.claude/skills/*/evals/*/fixture/`, `patches/`, `reports/`, `.stryker-tmp/`; replicar las entradas nuevas de fixtures en `ignores` de `eslint.config.mjs`. Agregar `reports/` y `.stryker-tmp/` a `.gitignore`.

---

## Phase 2: User Story 8 — Compilador vigente y herramientas al día (Priority: P2; va primero por R-09)

**Goal**: `tsc` es TypeScript 7; las herramientas importan la API 6.0; `build`, `typecheck`,
`lint`, `contract:types:check`, `arch` y `npm test` en verde (SC-008).

**Independent Test**: `npx tsc --version` → 7.x; `node -e 'console.log(require("typescript").version)'` → 6.0.x; quickstart §1b en verde.

### Tests

- [x] T004 [US8] En `tests/typecheck/typecheck.test.ts`, cambiar el código esperado del fixture `side-effect-import.ts` de `TS2307` a `TS2882` (código vigente en TS 7 para side-effect import inexistente, R-10); dejar constancia en el comentario del caso.
- [x] T005 [P] [US8] Crear `tests/typecheck/compiler-version.test.ts`: (a) `npx tsc --version` empieza con `Version 7.`; (b) `require("typescript").version` empieza con `6.0.`; (c) `package.json` declara `@typescript/native` como `npm:typescript@^7` y `typescript` como `npm:@typescript/typescript6@^6`.

### Implementation

- [x] T006 [US8] En `package.json`, reemplazar `"typescript": "5.9.3"` por `"typescript": "npm:@typescript/typescript6@^6.0.2"` y agregar `"@typescript/native": "npm:typescript@^7.0.2"` (R-10, ADR-017). `npm install`; verificar que `node_modules/.bin/tsc` es el de 7 (`npx tsc --version`).
- [x] T007 [US8] Corregir los 5 diagnósticos de `tsc -p tsconfig.scripts.json` con TS 7 (R-10): en `.dependency-cruiser.cjs` tipar `EXTERNAL` (y cualquier otro array literal usado como `dependencyTypes`) con `/** @type {import('dependency-cruiser').DependencyType[]} */` o `/** @type {const} */`; en `contracts/rules/functions/requiredErrorResponses.js` dejar sólo `module.exports = requiredErrorResponses` y mover `isAuthenticated` a `contracts/rules/functions/_auth.js` (módulo propio, `module.exports = { isAuthenticated }`) importado desde `requiredErrorResponses.js` y `requiredCapabilities.js`; actualizar `tsconfig.scripts.json`/`eslint.config.mjs` sólo si el archivo nuevo no queda cubierto por los globs existentes.
- [x] T008 [US8] Correr `npm run build && npm run typecheck && npm run lint && npm run contract:types:check && npm run arch && npm test` y `npm outdated`; si `outdated` lista algo fuera de `typescript`/`@typescript/native`, actualizarlo o anotarlo con motivo en ADR-017 §Decisión 5. Commit: `build(compilador): TypeScript 7 como compilador y API 6.0 para las herramientas (ADR-017)`.

**Checkpoint**: quickstart §1b en verde; `npm outdated` vacío o justificado.

---

## Phase 3: User Story 1 — Código y contrato en inglés (Priority: P1)

**Goal**: `check:language` existe, tiene fixtures y pasa sobre todo el alcance de FR-001 con
`Language exceptions: 0`; el contrato traducido es compatible (SC-007).

**Independent Test**: `npx vitest run tests/governance/language.test.ts` verde; `npm run check:language` exit 0; `npm run contract:diff` sin cambios rompientes.

### Tests

- [x] T009 [P] [US1] Crear fixtures en `tests/governance/fixtures/language/`: `accent.ts` (comentario con `ó`), `words-only.ts` (comentario "lista de eventos para el lote", sin acentos), `string.ts` (`throw new Error("El lote es inválido")`), `identifier-only.ts` (identificador `const orden = 1;` con comentario en inglés: debe pasar), `allowed.ts` (`// lang:es -- merchant-facing example` en la línea anterior a un string en español: debe pasar y contar 1), `allowed-no-reason.ts` (`// lang:es` sin ` -- motivo`: debe fallar), `english.ts` (sólo inglés, incluye las palabras `no`, `error`, `final`, `general`: debe pasar), `spanish.yaml` (`description: Lista de eventos`) y `allowed.yaml` (`# lang:es -- ejemplo` + línea en español).
- [x] T010 [P] [US1] Crear `tests/governance/language.test.ts` (usar `tests/governance/run.ts` como los otros checks): corre `scripts/check-language.mjs --root tests/governance/fixtures/language` y afirma que falla nombrando `accent.ts`, `words-only.ts`, `string.ts`, `allowed-no-reason.ts` y `spanish.yaml` con línea y fragmento; que no nombra `identifier-only.ts`, `allowed.ts`, `english.ts` ni `allowed.yaml`; que imprime `Language exceptions: 2`; y que `scripts/language-denylist.json` cumple los invariantes de data-model.md (sin palabras de una letra, sin acentos, minúsculas, sin duplicados, ninguna de `no`, `error`, `final`, `general`, `a`, `y`, `o`).

### Implementation

- [x] T011 [P] [US1] Crear `scripts/language-denylist.json` con `_doc` y `words`: artículos, preposiciones, conjunciones, pronombres y adverbios frecuentes del español sin equivalente en inglés (`el`, `la`, `los`, `las`, `un`, `una`, `unos`, `unas`, `del`, `al`, `que`, `para`, `por`, `con`, `sin`, `como`, `pero`, `cada`, `todo`, `toda`, `todos`, `todas`, `este`, `esta`, `esto`, `ese`, `esa`, `eso`, `su`, `sus`, `es`, `son`, `hay`, `tiene`, `tienen`, `puede`, `pueden`, `debe`, `deben`, `sobre`, `entre`, `desde`, `hasta`, `cuando`, `donde`, `porque`, `ya`, `nunca`, `siempre`, `solo`, `muy`, `menos`, `otro`, `otra`, `otros`, `otras`, `mismo`, `misma`, `ninguna`, `se`, `le`, `lo`, `nada`, `algo`, `si`, `ni`); sin `y`, `o`, `a` (R-01).
- [x] T012 [US1] Crear `scripts/check-language.mjs` según research R-01 y data-model.md: alcance = `src/`, `tests/`, `scripts/`, `contracts/`, `.github/`, `.claude/skills/*/scripts/`, y los archivos raíz `eslint.config.mjs`, `.dependency-cruiser.cjs`, `vitest.config.ts`, `lefthook.yml`, `redocly.yaml`, `package.json`, `knip.json`, `stryker.config.json`; exclusiones = entradas de `.prettierignore` + `scripts/language-denylist.json`; para `.ts/.mts/.cts/.js/.mjs/.cjs` tokeniza con `ts.createScanner` y examina sólo comentarios, strings y templates; para `.yaml/.yml/.json` examina la línea entera; detectores: `[áéíóúñÁÉÍÓÚÑ¿¡]` y `\b(palabra)\b` insensible a mayúsculas; excepción `lang:es -- motivo` en la línea o la anterior (sin motivo ⇒ hallazgo `missing reason`); salida humana `archivo:línea: fragmento` + `Language exceptions: N`; `--json` emite `{ gate: "language", mode: "blocking", status, findings }` (contracts/README §3); `--root` para las pruebas; exit 1 con hallazgos. Firmas JSDoc (`checkJs`).
- [x] T013 [US1] Traducir `contracts/` a inglés: `openapi.yaml` (`info.description`), `paths/*.yaml` (`summary`, `description`), `components/**/*.yaml` (`description`, `title` en prosa), `examples/**` (`title`, `detail`), `problem-types.yaml` (`title`, `description`), `no-op-reasons.yaml` (`description`), `.spectral.yaml` y `rules/functions/*.js` (`message`, comentarios), `oasdiff-severity.txt` si tiene prosa, `webhooks/`. Regenerar `npm run contract:types`; actualizar la réplica de títulos en `src/interface-adapters/http/problem-details.ts` y las pruebas que afirman `title`/`detail` literales (listarlas en el mensaje de commit, SC-004). `npm run contract:check` en verde, `contract:diff` sin rompientes. Commit: `refactor(contrato): descripciones, catálogos y mensajes de reglas en inglés (ADR-015)`.
- [x] T014 [US1] Traducir `src/**` (comentarios, strings, mensajes de error y de log; sin tocar identificadores ni comportamiento). Commit: `refactor(src): comentarios, mensajes y logs en inglés (ADR-015)`.
- [x] T015 [US1] Traducir `tests/**` (nombres de `describe`/`it`, comentarios, mensajes) sin cambiar aserciones salvo las de texto ya cubiertas por T013. Commit: `refactor(tests): nombres y comentarios en inglés (ADR-015)`.
- [x] T016 [US1] Traducir `scripts/**` (incluida la salida: `Excepciones de lint: N` → `Lint exceptions: N`, mensajes de `report()` de `governance-lib.mjs`), `contracts/rules/functions/` (si quedó algo en T013), configs raíz (`eslint.config.mjs`, `.dependency-cruiser.cjs`, `vitest.config.ts`, `lefthook.yml`, `redocly.yaml`, `package.json` `description`) y `.github/workflows/*.yml`; actualizar las pruebas que afirman sobre esa salida (`tests/governance/*`, `tests/lint/lint.test.ts`, `tests/hooks/lefthook.test.ts`). Commit: `refactor(scripts): salida, comentarios y configuraciones en inglés (ADR-015)`.
- [x] T017 [US1] Correr `npm run check:language`; resolver lo que quede (traducir, o `lang:es -- motivo` sólo donde el texto deba ser español); objetivo `Language exceptions: 0`. Actualizar `CLAUDE.md`: línea de idioma ("Código, comentarios, strings y contrato: inglés; documentación, specs, ADRs, glosario y commits: español"), `Lint exceptions: N` en la tabla de comandos y en Tipado, fila `check:language` en la tabla, y la mención "Los cuatro `check:*`" → "Los cinco". Commit: `feat(gobernanza): check:language con lista de palabras y excepción en línea (ADR-015)`.

**Checkpoint**: `npm run contract:check` (incluye `check:language`) y `npm test` en verde.

---

## Phase 4: User Story 2 — Forma del código (Priority: P1)

**Goal**: `lint` falla ante complejidad, anidamiento, parámetros, longitud, duplicación semántica, `catch` ignorado y números mágicos; cada regla con fixture; código existente en verde sin excepciones.

**Independent Test**: `npx vitest run tests/lint` verde; `npm run lint` exit 0 con `Lint exceptions: 0`.

### Tests

- [x] T018 [P] [US2] Crear fixtures en `tests/lint/fixtures/`: `cognitive-complexity.ts` (función con complejidad > 15), `max-depth.ts` (4 niveles), `max-params.ts` (5 parámetros), `max-lines-per-function.ts` (61 líneas de código), `no-identical-functions.ts`, `no-all-duplicated-branches.ts`, `no-identical-conditions.ts`, `no-collapsible-if.ts`, `no-redundant-boolean.ts`, `no-ignored-exceptions.ts` (`catch {}` vacío), `no-magic-numbers.ts` (`const ttl = 24 * 60 * 60 * 1000;`), y `magic-numbers-allowed.ts` (`0`, `1`, `-1`, índice de array: debe pasar).
- [x] T019 [US2] Extender `tests/lint/lint.test.ts`: agregar al mapa `expected` cada fixture nuevo con su regla (`sonarjs/cognitive-complexity`, `max-depth`, `max-params`, `max-lines-per-function`, `sonarjs/no-identical-functions`, `sonarjs/no-all-duplicated-branches`, `sonarjs/no-identical-conditions`, `sonarjs/no-collapsible-if`, `sonarjs/no-redundant-boolean`, `sonarjs/no-ignored-exceptions`, `@typescript-eslint/no-magic-numbers`); afirmar que `magic-numbers-allowed.ts` y `valid.ts` pasan; afirmar que `max-lines-per-function` y `no-magic-numbers` están **apagadas** para un archivo bajo `tests/` (lintear un fixture copiado a una ruta `tests/lint/fixtures/as-test/x.test.ts` o usar `ESLint.calculateConfigForFile`); afirmar que cada umbral numérico de `eslint.config.mjs` tiene un comentario en la línea anterior o la misma (FR-013: leer el archivo y buscar `15`, `3`, `4`, `60` junto a `//`).

### Implementation

- [x] T020 [US2] En `eslint.config.mjs` agregar el plugin `sonarjs` y el bloque de reglas de research R-02 con **comentario de justificación por umbral**: `sonarjs/cognitive-complexity: ["error", 15]`, `max-depth: ["error", 3]`, `max-params: ["error", 4]`, `max-lines-per-function: ["error", { max: 60, skipBlankLines: true, skipComments: true }]`, `sonarjs/no-identical-functions`, `no-all-duplicated-branches`, `no-identical-conditions`, `no-collapsible-if`, `no-redundant-boolean`, `no-ignored-exceptions` en `error`; bloque `files: ["src/**/*.ts"]` con `@typescript-eslint/no-magic-numbers: ["error", { ignore: [0, 1, -1], ignoreArrayIndexes: true, ignoreTypeIndexes: true, ignoreEnums: true, ignoreReadonlyClassProperties: true }]`; bloque `files: ["tests/**"]` con `max-lines-per-function: "off"` y `@typescript-eslint/no-magic-numbers: "off"` con su comentario.
- [x] T021 [P] [US2] Crear `src/domain/shared-kernel/time.ts` (exportado por `index.ts`): `MS_PER_SECOND`, `SECONDS_PER_MINUTE`, `MINUTES_PER_HOUR`, `seconds(n)`, `minutes(n)`, `hours(n)` con prueba unitaria en `tests/unit/time.test.ts`; usarlo en `src/domain/ingestion/batch.ts` (`TIMESTAMP_TOLERANCE`) y `src/interface-adapters/gateways/ingestion/memory-event-dedup.ts` (`DEDUP_WINDOW`).
- [x] T022 [P] [US2] Nombrar el resto de números mágicos de `src/` (R-02): `DEFAULT_PORT = 3000` y `MAX_INGEST_KEYS = 2` en `src/composition/config.ts`; `HTTP_ERROR_THRESHOLD = 400` (o usar `PROBLEM_CONTENT_TYPE` por rango con nombre) en `src/infrastructure/http/build-server.ts`; cualquier otro que `npm run lint` reporte.
- [x] T023 [US2] Partir `buildServer` en `src/infrastructure/http/build-server.ts` en funciones de menos de 60 líneas con nombre por responsabilidad (registro de seguridad, de handlers, de errores/Problem Details, de CORS y logging), sin cambiar comportamiento (`npm test` y `npm run test:contract` en verde); reducir el anidamiento en `scripts/check-glossary.mjs:210-218` (extraer función) y partir `main` de `scripts/contract-diff.mjs` y `scripts/test-contract.mjs` en pasos con nombre.
- [x] T024 [US2] `npm run lint` en verde con `Lint exceptions: 0`; `npm test` en verde. Commit: `feat(calidad): límites de forma, duplicación semántica y números mágicos en el lint (ADR-016)`.

**Checkpoint**: `tests/lint` verde; `npm run lint` exit 0.

---

## Phase 5: User Story 3 — Duplicación y código muerto (Priority: P2)

**Goal**: `check:duplication` y `check:dead-code` existen, con fixtures, bloquean en `src/` y pasan sobre el repo.

**Independent Test**: `npx vitest run tests/governance/duplication.test.ts tests/governance/dead-code.test.ts` verde; ambos comandos exit 0.

### Tests

- [x] T025 [P] [US3] Crear `tests/governance/fixtures/duplication/` con `src/a.ts` y `src/b.ts` que comparten un bloque de 8 líneas / > 50 tokens, y `tests/c.test.ts` con el mismo bloque; y `tests/governance/duplication.test.ts`: `check-duplication.mjs --root <fixture>` falla nombrando `src/a.ts` y `src/b.ts` con líneas; con `--root` apuntando sólo a la parte `tests/` sale 0 y lista el clon como informativo; `--json` emite `{ gate: "duplication", mode, status, findings }`.
- [x] T026 [P] [US3] Crear `tests/governance/fixtures/dead-code/` (mini proyecto con `package.json`, `src/main.ts` que importa `src/used.ts`, `src/unused.ts` sin importador, `src/used.ts` con un `export const orphan` sin uso y un `export type Unused`, y una dependencia declarada sin importar) y `tests/governance/dead-code.test.ts`: `check-dead-code.mjs --root <fixture>` falla nombrando `src/unused.ts`, `orphan` y la dependencia; **no** falla por `Unused` (tipo: informativo, listado aparte); `--json` emite `{ gate: "dead-code", ... }`.

### Implementation

- [x] T027 [P] [US3] Crear `scripts/check-duplication.mjs` (API programática de jscpd, R-03): pasada bloqueante sobre `src/` (`ignore: ["**/generated/**"]`, `minTokens: 50`, `minLines: 5`, `format: ["typescript"]`, con comentario de justificación de los umbrales) → exit 1 si hay clones, nombrando ambos lugares; pasada informativa sobre `tests/` y `scripts/` (`ignore: ["**/fixtures/**"]`) → lista y exit 0; `--root`, `--json`; JSDoc.
- [x] T028 [P] [US3] Crear `knip.json` según research R-04: `entry` (`src/main.ts`, `src/interface-adapters/http/client.ts`, `scripts/*.mjs`, `contracts/rules/functions/*.js`, `tests/**/*.test.ts`, `tests/**/*.test-d.ts`, `tests/contract-rules/gen-fixtures.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `.dependency-cruiser.cjs`, `stryker.config.json` si aplica, `.claude/skills/*/scripts/*.mjs`), `project`, `ignore` (`tests/**/fixtures/**`, `src/interface-adapters/http/generated/**`, `.claude/skills/*/evals/**`), `ignoreDependencies` (Redocly, Spectral bundler, redoc, jscpd y los tres paquetes de Stryker) con el motivo documentado en el encabezado de `check-dead-code.mjs` (knip rechaza claves desconocidas como `_doc`) (`runCli("redocly")`) y lectura de `node_modules` en `contract-docs.mjs`, `ignoreBinaries: ["uvx"]`. Crear `scripts/check-dead-code.mjs`: corre knip con `--reporter json`, falla ante `files`, `exports`, `dependencies`, `unlisted`, `binaries`; imprime `types`/`nsTypes` como informativos; `--root`, `--json`; JSDoc.
- [x] T029 [US3] Resolver el clon real de `src/` (R-03): agregar `invariantResponse(req, result)` a `src/interface-adapters/http/problem-details.ts` (traduce `{ ok: false, invariant, detail }` → `{ status: 422, body }`) y usarlo en `src/interface-adapters/http/controllers/ingestion/ingest-events.ts` y `.../ledger/confirm-exposure.ts`; prueba unitaria en `tests/unit/problem-details.test.ts`.
- [x] T030 [US3] Resolver los hallazgos de knip sobre el repo (R-04): agregar `@stoplight/spectral-parsers` (hecho en T001); revisar los 20 exports sin uso uno a uno (quitar `export` si sólo se usa en el archivo; borrar si no se usa; conservar con `/** @public */` sólo si es API de módulo con consumidor en una feature ya especificada, anotando cuál); dejar los `types` informativos. `npm run check:duplication && npm run check:dead-code` exit 0. Commit: `feat(calidad): detección de duplicación estructural y código muerto (ADR-016)`.

**Checkpoint**: ambos checks en verde sobre el repo; sus pruebas en verde.

---

## Phase 6: User Story 4 — Mutación sobre el diff (Priority: P2)

**Goal**: `test:mutation` muta sólo las líneas del diff contra `origin/main` y falla si un mutante sobrevive; sweep completo informativo; runner parcheado para Vitest 5.

**Independent Test**: `npx vitest run tests/governance/mutation-diff.test.ts` verde; quickstart §5 (mutante sobreviviente → falla; prueba corregida → pasa).

### Tests

- [ ] T031 [P] [US4] Crear `tests/governance/mutation-diff.test.ts` sobre las funciones puras exportadas por `scripts/mutation-diff.mjs`: (a) `rangesFromDiff(diffText)` con diffs sintéticos `--unified=0`: un hunk `@@ -10,0 +11,3 @@` en `src/x.ts` → `["src/x.ts:11-13"]`; hunk de sólo borrado (`+20,0`) → sin rango; archivo fuera de `src/` → ignorado; archivo en `ignorePatterns` (`src/composition/ports.ts`, `src/main.ts`, `*.d.ts`, `generated/`) → ignorado; (b) `decide(ranges, baseRef)`: sin rangos → `{ skipped: "no-production-lines" }`; sin base → `{ skipped: "no-base-ref" }`; (c) `guardZeroTests(report)`: un reporte JSON sintético con un mutante `Survived`, `testsCompleted: 0` y `coveredBy: ["t1"]` → error `mutation runner executed zero tests for covered mutants`; el mismo con `testsCompleted: 3` → sin error.
- [ ] T032 [P] [US4] Crear `tests/hooks/patches.test.ts`: `patches/@stryker-mutator+vitest-runner+10.0.0.patch` existe, su encabezado cita `stryker-js#6210` y `#6214` y la condición de retiro, y `node_modules/@stryker-mutator/vitest-runner/dist/src/stryker-setup.js` y `test-helpers.js` contienen `join(' > ')` (el parche está aplicado tras `npm install`).

### Implementation

- [ ] T033 [US4] Aplicar el fix de stryker-js#6214 en `node_modules/@stryker-mutator/vitest-runner/dist/src/stryker-setup.js` y `dist/src/test-helpers.js` (`nameParts.join(' ')` → `nameParts.join(' > ')`), generar `patches/@stryker-mutator+vitest-runner+10.0.0.patch` con `npx patch-package @stryker-mutator/vitest-runner`, y anteponer al archivo un comentario de encabezado: bug, issue #6210, PR #6214, condición de retiro ("borrar cuando `@stryker-mutator/vitest-runner` publique el fix; `patch-package` falla si el parche ya no aplica"). Verificar `npm ci && ls node_modules/@stryker-mutator/vitest-runner` re-aplica.
- [ ] T034 [P] [US4] Crear `stryker.config.json` según research R-05: `$comment` con la referencia al parche y a ADR-016; `testRunner: "vitest"`, `vitest.configFile: "vitest.config.ts"`, `checkers: ["typescript"]`, `tsconfigFile: "tsconfig.json"`, `coverageAnalysis: "perTest"`, `ignorePatterns` (`src/interface-adapters/http/generated/**`, `src/composition/**`, `src/main.ts`, `**/*.d.ts`, `src/**/index.ts`), `reporters: ["clear-text", "progress", "html", "json"]`, `htmlReporter.fileName: "reports/mutation/index.html"`, `jsonReporter.fileName: "reports/mutation/report.json"`, `tempDirName: ".stryker-tmp"`, `concurrency: 4` con justificación.
- [ ] T035 [US4] Crear `scripts/mutation-diff.mjs` (R-05, data-model §Rangos): resuelve base (`CONTRACT_BASE_REF` o `origin/main`, reutilizando la lógica de `scripts/contract-diff.mjs` si está en `lib.mjs`); `git diff --unified=0 <base>...HEAD -- src`; `rangesFromDiff` → `mutate`; sin rangos/base → imprime motivo, `--json` `{ gate: "mutation", mode: "blocking", status: "pass", skipped }`, exit 0; corre `stryker run stryker.config.json --mutate <rangos> --break 100` (o vía API `Stryker.runMutationTest`); lee `reports/mutation/report.json` y aplica `guardZeroTests`; `--all` muta todo sin `break` (`mode: "informative"`); `--json`; JSDoc; exporta `rangesFromDiff`, `decide`, `guardZeroTests` para las pruebas.
- [ ] T036 [US4] Validar manualmente quickstart §5 (función nueva con prueba vacía → falla nombrando el mutante; prueba corregida → pasa) y correr `npm run test:mutation -- --all` una vez para confirmar tiempo y reporte (anotar resultado en el mensaje de commit, no en prosa viva). Commit: `feat(calidad): mutación sobre el diff con Stryker y runner parcheado para Vitest 5 (ADR-016)`.

**Checkpoint**: `tests/governance/mutation-diff.test.ts` y `tests/hooks/patches.test.ts` verdes; `npm run test:mutation` en la rama devuelve `no production lines changed` o pasa.

---

## Phase 7: User Story 5 — Forma de los anillos (Priority: P2)

**Goal**: `tests/architecture/shape.test.ts` con tres reglas nuevas y sus fixtures; verificación de que la regla existente `modules-only-via-index` tiene fixture.

**Independent Test**: `npx vitest run tests/architecture` verde.

### Tests

- [ ] T037 [P] [US5] Crear fixtures en `tests/architecture/fixtures/shape/`: `too-long/src/domain/x/big.ts` (301 líneas), `controllers/src/interface-adapters/http/controllers/x/two-ops.ts` (registra dos `operationId`) + `controllers/openapi.yaml` mínimo con tres `operationId` de los que sólo dos tienen archivo, `new-outside/src/interface-adapters/http/controllers/x/bad-new.ts` (`new MemoryDecisionLedger()`), `new-allowed/src/application/x/ok.ts` (`new Date()`, `new Map()`, `new DomainError()` con `class DomainError` en `src/domain/x/`).
- [ ] T038 [US5] Crear `tests/architecture/shape.test.ts` con las tres reglas de research R-06 como funciones puras sobre un `root` (para correr sobre `src/` y sobre cada fixture): (1) `maxFileLines(root, ["domain", "application"], 300)` con el 300 justificado en comentario; (2) `oneControllerPerOperation(root, bundlePath)`: cada `operationId` del bundle ↔ exactamente un `controllers/<módulo>/<kebab(operationId)>.ts` y viceversa; (3) `newOnlyInComposition(root)`: fuera de `composition/`, `infrastructure/` y `interface-adapters/gateways/`, todo `new X(` es builtin (`Date`, `Map`, `Set`, `WeakMap`, `WeakSet`, `Error` y subclases nativas, `URL`, `URLSearchParams`, `RegExp`, `Promise`, `Intl.*`, `TextEncoder`, `TextDecoder`, `AbortController`) o clase declarada en `domain/`/`application/`. Casos: `src/` pasa las tres; cada fixture `bad` falla la suya nombrando el archivo; `new-allowed` pasa. Afirmar además que `tests/architecture/fixtures/src/application/ledger/bad-internal-import.ts` existe y es atrapado por `modules-only-via-index` (FR-041; ya cubierto por `architecture.test.ts` — referenciar, no duplicar).

### Implementation

- [ ] T039 [US5] Corregir lo que `shape.test.ts` reporte sobre `src/` (el sondeo dio 0 violaciones; si el refactor de T023 introdujo un `new` fuera de lugar, moverlo a `composition/`). Commit: `test(arquitectura): forma de los anillos — tamaño, un controller por operación, instanciación sólo en composición (ADR-016)`.

**Checkpoint**: `npx vitest run tests/architecture` verde.

---

## Phase 8: User Story 6 — Un comando en CI (Priority: P2)

**Goal**: `npm run quality` encadena los gates, nombra el rojo; CI corre `quality`, `test:mutation` y el sweep programado; guía actualizada.

**Independent Test**: `npm run quality` exit 0; con una violación inyectada, exit 1 y la primera línea nombra el gate; `.github/workflows/ci.yml` tiene los pasos.

### Tests

- [ ] T040 [P] [US6] Crear `tests/governance/quality.test.ts`: `scripts/quality.mjs` exporta la lista ordenada de gates (`lint`, `arch`, `check:duplication`, `check:dead-code`, `check:language`); con un runner inyectado que falla en el tercero, la salida empieza con `quality: check:duplication failed` y no ejecuta los siguientes; `--json` concatena `{ gates: [...] }`.
- [ ] T041 [P] [US6] Extender `tests/hooks/lefthook.test.ts` (o crear `tests/hooks/ci.test.ts`): `.github/workflows/ci.yml` contiene los pasos `npm run quality` (después de `npm run lint`) y `npm run test:mutation` (después de `npm test`), y existe un job `mutation-full` con `schedule` y `workflow_dispatch` que corre `npm run test:mutation -- --all` con `continue-on-error: true` y sube `reports/mutation/` como artefacto.

### Implementation

- [ ] T042 [US6] Crear `scripts/quality.mjs` (forma de `release-check.mjs`): corre los gates en orden con `spawnSync("npm", ["run", gate])`, se detiene en el primero rojo imprimiendo `quality: <gate> failed`, exit 1; `--json` invoca cada script con `--json` y concatena; JSDoc; exporta `GATES` y `runQuality(runner)` para la prueba.
- [ ] T043 [US6] Actualizar `.github/workflows/ci.yml`: paso `npm run quality` tras `npm run lint`; paso `npm run test:mutation` tras `npm test` (necesita `fetch-depth: 0` y `origin/main`, ya presentes); job `mutation-full` (`schedule: cron "0 6 * * 1"`, `workflow_dispatch`, `continue-on-error`, `actions/upload-artifact` de `reports/mutation/`). Comentarios en inglés.
- [ ] T044 [US6] Actualizar `CLAUDE.md`: filas de la tabla de comandos para `quality`, `check:duplication`, `check:dead-code`, `test:mutation`; sección "Gates de calidad (ADR-016)" breve (umbrales y dónde viven, sin cifras de estado); paso 5 del flujo incluye `npm run quality`; sección Tipado menciona TypeScript 7 + API 6.0 (ADR-017) y que `no-magic-numbers` y los límites de forma aplican en `src/`. Commit: `feat(calidad): comando quality, CI y guía de agentes (ADR-016)`.

**Checkpoint**: `npm run quality` verde local; CI verde en la rama.

---

## Phase 9: User Story 7 — Skill de auditoría (Priority: P3)

**Goal**: `.claude/skills/auditing-architecture/` con SKILL.md, referencias, scripts, evals; `tests/audit/` verde; SC-005 verificado manualmente.

**Independent Test**: `npx vitest run tests/audit` verde; correr la skill sobre los tres evals produce el hallazgo esperado, confirmado y verificado, tres veces.

### Tests

- [ ] T045 [P] [US7] Crear los tres evals (FR-066, data-model §Escenario) en `.claude/skills/auditing-architecture/evals/`: `controller-instantiates-infra/` (fixture: controller con `new MemoryDecisionLedger()`; `expected.json`: `rule.source: "constitution#I"`, `severity: "high"`, archivo y línea), `identical-domain-functions/` (dos funciones iguales en `src/domain/x/`; `expected.json`: `rule.source: "lint:sonarjs/no-identical-functions"`, `severity: "medium"`), `empty-catch/` (`catch {}` en un caso de uso; `expected.json`: `rule.source: "lint:sonarjs/no-ignored-exceptions"`, `severity: "medium"`, y en `README.md` la nota de que la revisión cognitiva debe agregar el `NO_OP` con motivo, constitución II). Cada uno con `README.md`.
- [ ] T046 [P] [US7] Crear `tests/audit/audit.test.ts`: (a) `scripts/run-gates.mjs --dir <eval>/fixture --json` reporta, para cada eval, el gate que lo ve (`arch`/`shape` para el primero, `lint` para los otros dos) con `status: "fail"` y el archivo esperado; (b) `scripts/verify-finding.mjs <expected.json>` devuelve `verified: true` para cada `expected.json`; (c) devuelve `verified: false` con `reason` para un hallazgo con `line` fuera del archivo, con `file` inexistente, con `rule.source: "ADR-999"`, con `rule.source: "lint:no-such-rule"`, y con `severity: "low"` junto a `rule.source: "ADR-013"` (violación del esquema `contracts/audit-finding.schema.json`).

### Implementation

- [ ] T047 [P] [US7] Copiar `specs/005-auditoria-calidad/contracts/audit-finding.schema.json` a `.claude/skills/auditing-architecture/scripts/audit-finding.schema.json` (la skill es autocontenida; anotar en el README de contracts que la copia en la skill es la que se ejecuta) y crear `scripts/verify-finding.mjs`: valida cada hallazgo con Ajv contra el esquema; comprueba que `file` existe y `line` ≤ líneas del archivo; resuelve `rule.source`: `ADR-NNN` → `docs/adr/NNN-*.md` existe; `constitution#<sección>` → encabezado que contiene la sección en `.specify/memory/constitution.md`; `guide#<sección>` → encabezado en `CLAUDE.md`; `lint:<regla>` → la regla aparece en `eslint.config.mjs`; `arch:<regla>` → `name:` en `.dependency-cruiser.cjs`; `clarity:<slug>` → siempre resuelve. Salida: el mismo JSON con `verified` y `reason`; exit 1 si alguno es `false`. Reutiliza `scripts/governance-lib.mjs` (importar por ruta relativa al repo). JSDoc; en inglés.
- [ ] T048 [P] [US7] Crear `scripts/run-gates.mjs`: acepta `--module <nombre>` (→ `src/domain/<nombre>`, `src/application/<nombre>`, `src/interface-adapters/**/<nombre>`), `--dir <ruta>` o `--diff` (archivos de `git diff --name-only origin/main...HEAD -- src`); corre `lint` (`eslint --format json` sobre los archivos), `arch` (`depcruise --output-type json` sobre `src/` filtrando por los archivos), `shape` (importa las funciones de `tests/architecture/shape.test.ts` — o extraerlas a `tests/architecture/shape-rules.ts` para poder importarlas), `check:duplication --json`, `check:dead-code --json`, `check:language --json` y, con `--diff`, `test:mutation --json`; emite `{ scope, files, gates: [...] }`; exit 0 siempre (la skill decide). JSDoc; en inglés.
- [ ] T049 [P] [US7] Crear `references/criterios-diseno.md` (en español, con tabla de contenidos): un bloque por principio según data-model §Criterio — SRP (constitución I, ADR-013: una autoridad/módulo por carpeta), OCP (ADR-013: módulo nuevo = entrada en `CONTEXT_MAP`), LSP (perfiles de `Ports` intercambiables sin tocar pruebas), ISP (puertos por caso de uso en `application/<módulo>/ports/`), DIP (`arch:controllers-no-gateways`, `arch:adapters-inward`), DRY (ADR-008; catálogos replicados sólo con prueba de réplica: `problem-types.yaml` ↔ `problem-details.ts`), claridad (nombres con intención, `NO_OP` con motivo — constitución II), errores (`lint:sonarjs/no-ignored-exceptions`, Problem Details — ADR-001/002); cada uno con `viola`, `cumple` y "lo ve un gate: sí/no".
- [ ] T050 [P] [US7] Crear `references/formato-hallazgo.md` (esquema explicado campo a campo, tabla de severidad por fuente, regla del estado global de data-model §Reporte, ejemplo completo de hallazgo `confirmed` y uno `refuted`) y `references/refutacion.md` (preguntas de la segunda pasada: ¿coincidencia o conocimiento? ¿hay ADR que lo justifique? ¿la prueba propuesta fallaría hoy? ¿el "God Object" es el composition root? ¿la duplicación es entre anillos que no pueden compartir código?).
- [ ] T051 [US7] Crear `SKILL.md` (< 150 líneas, español): frontmatter `name: auditing-architecture`, `description` en tercera persona con disparadores ("auditar", "revisar arquitectura", "SOLID", "deuda técnica", "calidad del módulo", "revisar el diff"); checklist de 7 pasos: (1) resolver alcance (`--module`/`--dir`/`--diff`; alcance vacío → decirlo y terminar); (2) `node .claude/skills/auditing-architecture/scripts/run-gates.mjs <alcance> --json` y tratar la salida como hechos; (3) leer `references/criterios-diseno.md`; (4) proponer hallazgos en JSON según `references/formato-hallazgo.md` (`status: proposed`); (5) refutar cada uno con `references/refutacion.md` → `confirmed`/`refuted` con `refutation`; (6) `node .../scripts/verify-finding.mjs findings.json` y descartar los `verified: false` diciéndolo; (7) reporte con las secciones de data-model §Reporte y estado global derivado (regla explícita en el SKILL.md). Prohibiciones explícitas: sin puntuación numérica; ningún hallazgo sin `file:line`; ningún hallazgo que un gate ya reporta salvo que agregue el caso que la regla no ve.
- [ ] T052 [US7] Evaluación manual (SC-005): correr la skill tres veces sobre cada eval y anotar el resultado en `evals/RESULTS.md` con fecha (histórico, no prosa viva); ajustar `SKILL.md`/referencias si algún eval falla. `npx vitest run tests/audit` verde. Commit: `feat(auditoria): skill auditing-architecture con gates, criterios del repo, verificación de hallazgos y evals`.

**Checkpoint**: `tests/audit` verde; `evals/RESULTS.md` con tres corridas verdes por eval.

---

## Phase 10: Polish & Cross-Cutting

- [ ] T053 Pasar ADR-015, ADR-016 y ADR-017 de `estado: propuesta` a `aceptada` (revisar que su contenido coincida con lo implementado: nombres de scripts, umbrales, condición de retiro del parche y del alias); `npm run check:adrs`.
- [ ] T054 [P] Actualizar `docs/adr/README.md` si la lista/índice de ADRs es explícita; agregar al `README.md` del repo (español) la sección de comandos de calidad si existe una tabla equivalente.
- [ ] T055 [P] Verificar `.vscode/extensions.json`: recomendar la extensión de TypeScript nativo si aplica (`ms-vscode.vscode-typescript-next` o la que Microsoft indique para TS 7) y `settings.json` `typescript.tsdk` apuntando a `node_modules/typescript/lib` (API 6.0 para el editor) con comentario.
- [ ] T056 Correr `quickstart.md` completo (§1–§8) y `npm run release-check`; registrar en `specs/005-auditoria-calidad/quickstart.md` una tabla de estado **fechada** con el resultado de cada sección (histórica).
- [ ] T057 Abrir PR `005-auditoria-calidad` → `main` con la descripción de gates del Constitution Check aplicados (superficie HTTP sólo idioma: `contract:diff` limpio; `src/`: `arch` en 0) y la lista de aserciones de texto modificadas (SC-004). No hacer push sin que el usuario lo pida.

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** → **Phase 2 (US8, compilador)**: bloquea todo lo demás (lint con tipos y tipos del contrato dependen de la API).
- **Phase 3 (US1, idioma)**: después de US8; bloquea US2–US7 por decisión de R-09 (cada archivo se toca una vez), no por dependencia técnica.
- **Phase 4 (US2)**, **Phase 5 (US3)**, **Phase 7 (US5)**: independientes entre sí tras US1; en paralelo si hay capacidad. US3 (T029) y US2 (T023) tocan `build-server.ts`/controllers: coordinar el orden si van en paralelo.
- **Phase 6 (US4, mutación)**: después de Setup; independiente de US2/US3/US5, pero conviene tras US1 (nombres de pruebas en inglés en el reporte).
- **Phase 8 (US6, quality + CI)**: después de US2, US3, US5 (los gates que encadena) y US4.
- **Phase 9 (US7, skill)**: después de US6 (`run-gates` invoca `quality` y `test:mutation`) y de US5 (`shape-rules`).
- **Phase 10**: al final.

### Parallel Opportunities

- Phase 1: T003 con T001/T002.
- US8: T004 ∥ T005.
- US1: T009 ∥ T010 ∥ T011; T013 → T014 → T015 → T016 son commits separados y secuenciales (cada uno deja la suite en verde).
- US2: T018 ∥ (T021 ∥ T022) tras T020.
- US3: T025 ∥ T026 ∥ T027 ∥ T028.
- US4: T031 ∥ T032 ∥ T034.
- US6: T040 ∥ T041.
- US7: T045 ∥ T046 ∥ T047 ∥ T048 ∥ T049 ∥ T050.

---

## Implementation Strategy

**MVP** = Phase 1 + US8 + US1 (compilador vigente y todo en inglés con su gate): entrega la
decisión del usuario más costosa y deja el repo listo para que los gates nazcan sobre código
final. Cada historia siguiente agrega un gate independiente y verificable; US7 sólo al final,
cuando hay hechos sobre los que pararse.

Commits por historia según los mensajes indicados en cada tarea; todos en español,
conventional commits; ningún commit sin `contract:check`, `format:check`, `lint`, `typecheck`,
`arch` y `test` en verde. Sin push hasta que el usuario lo pida.
