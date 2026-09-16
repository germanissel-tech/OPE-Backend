# Tasks: Calidad de código — tipado fuerte verificable, lint y formato

**Input**: Design documents from `specs/003-calidad-de-codigo/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: exigidas por FR-051 (un caso que viola por regla clave). Los fixtures y pruebas se
escriben antes de la configuración que los hace pasar.

**Organization**: por historia. El orden de commits del plan ("Diseño") manda: configuración
y pruebas → formato (commit aparte, sólo Prettier) → correcciones de lint → JSDoc y
`checkJs` → compilador, hook, CI, guía, ADRs.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Proyecto único, raíz `backend/`. Configuraciones en la raíz; fixtures en `tests/<área>/fixtures/`.

---

## Phase 1: Setup

- [ ] T001 Instalar devDependencies: `eslint@^10.10`, `typescript-eslint@^8.70`, `@eslint/js@^10`, `globals@^17`, `eslint-plugin-import-x@^4.17`, `@eslint-community/eslint-plugin-eslint-comments@^4.8`, `eslint-config-prettier@^10`, `prettier@^3.9`, `lefthook@^2.1`; agregar a `package.json` los scripts `lint` (`eslint . && node scripts/check-lint-exceptions.mjs`), `lint:fix` (`eslint . --fix`), `format` (`prettier --write .`), `format:check` (`prettier --check .`) y cambiar `typecheck` a `tsc -p tsconfig.typecheck.json && tsc -p tsconfig.scripts.json`. Commitear `package-lock.json`.
- [ ] T002 [P] Crear `.editorconfig` según research R-06 (`root = true`; `[*]` espacio 2, `lf`, `utf-8`, `insert_final_newline`, `trim_trailing_whitespace`; `[*.md] trim_trailing_whitespace = false`).
- [ ] T003 [P] Crear `.prettierrc.json` (`printWidth: 110`, `singleQuote: false`, `semi: true`, `trailingComma: "all"`, `endOfLine: "lf"`, `proseWrap: "preserve"`) y `.prettierignore` con la lista única de FR-011: `dist/`, `node_modules/`, `src/generated/`, `contracts/dist/`, `docs/api/`, `.schemathesis/`, `package-lock.json`, `tests/architecture/fixtures/`, `tests/contract-rules/fixtures/`, `tests/governance/fixtures/`, `tests/lint/fixtures/`, `tests/typecheck/fixtures/`, `.specify/`, `.claude/`.

---

## Phase 2: Foundational

- [ ] T004 Agregar `vitest.config.ts` y `eslint.config.mjs` al `include` de `tsconfig.typecheck.json` (con `allowJs: true` sólo si `eslint.config.mjs` lo requiere; si no, dejar el config fuera del typecheck y lintearlo sin tipos) y crear `tsconfig.scripts.json` según data-model.md (`allowJs`, `checkJs`, `noEmit`, `strict`, `noUncheckedIndexedAccess`, `module`/`moduleResolution: NodeNext`, `target: ES2022`, `types: ["node"]`, `skipLibCheck`; `include`: `scripts/**/*.mjs`, `contracts/rules/functions/*.js`, `tests/contract-rules/gen-fixtures.mjs`, `.dependency-cruiser.cjs`).
- [ ] T005 Crear `eslint.config.mjs` (flat config) según research R-01 y data-model.md: `ignores` (generados y todos los `tests/**/fixtures/`), `@eslint/js` recommended, `strictTypeChecked` + `stylisticTypeChecked`, `parserOptions.project: ["./tsconfig.typecheck.json"]`, `globals.node`; reglas explícitas en `error`: `no-explicit-any`, `no-floating-promises`, `no-misused-promises`, `no-non-null-assertion`, `switch-exhaustiveness-check`, `consistent-type-imports` (`fixStyle: inline-type-imports`), `ban-ts-comment` (`ts-expect-error: allow-with-description`), `import-x/order` (alfabético, sin líneas entre grupos, `type` al final), `import-x/no-duplicates` (`prefer-inline`), `import-x/first`, `eslint-comments/require-description`, `eslint-comments/no-unused-disable`; `linterOptions.reportUnusedDisableDirectives: "error"`; `require-await: "off"` con el comentario de justificación de R-01; `restrict-template-expressions` con `allowNumber: true`; bloque para JS (`**/*.mjs`, `**/*.cjs`, `contracts/rules/functions/*.js`) con `disableTypeChecked`; bloque CommonJS (`contracts/rules/functions/*.js`, `**/*.cjs`) con `sourceType: commonjs` y `no-require-imports: off`; `eslint-config-prettier` al final.
- [ ] T006 [P] Crear `scripts/check-lint-exceptions.mjs`: recorre `src/`, `tests/` (sin `fixtures/`), `scripts/`, `contracts/rules/functions/` buscando `eslint-disable` y `@ts-expect-error`/`@ts-ignore` fuera de `tests/types/`; imprime `archivo:línea: <directiva> — <motivo>` y `Excepciones de lint: N`; nunca falla (el conteo es informativo; la ausencia de motivo la falla ESLint).

**Checkpoint**: `npm run lint` corre (rojo con los ~76 hallazgos del sondeo), `npm run format:check` corre (rojo), `npm run typecheck` corre (rojo por `checkJs`).

---

## Phase 3: User Story 2 — Formato único (Priority: P1; va primero: commit aislado de sólo formato)

**Goal**: `format:check` verde sobre todo el repo; un solo commit `chore: formato` sin cambios semánticos.

**Independent Test**: `tests/format/format.test.ts` en verde; `npm run format:check` exit 0.

### Tests

- [ ] T007 [P] [US2] Crear `tests/format/format.test.ts`: (a) escribe en un directorio temporal un `.ts`, un `.json`, un `.yaml` y un `.md` mal formateados (comillas simples, sin punto y coma, `*énfasis*`), corre `prettier --check --config <repo>/.prettierrc.json` sobre ellos → exit ≠ 0 nombrando cada archivo; (b) `--write` → exit 0 y `--check` pasa; (c) segunda `--write` deja los archivos byte a byte iguales (FR-012); (d) `.prettierignore` contiene cada ruta de FR-011 (lee el archivo y afirma las entradas).

### Implementation

- [ ] T008 [US2] Correr `npm run format` sobre el repo, revisar el diff (sólo formato: sin cambios en strings, lógica ni contenido de Markdown más allá de énfasis/alineación), verificar `npm test` y `npm run contract:check` en verde, y commitear **solo** eso como `chore: formato único con Prettier`.

**Checkpoint**: `npm run format:check` exit 0.

---

## Phase 4: User Story 1 — Tipado fuerte que se hace cumplir (Priority: P1)

**Goal**: `npm run lint` verde con cero excepciones; cada regla clave tiene fixture.

**Independent Test**: `tests/lint/lint.test.ts` en verde; `npm run lint` exit 0 y `Excepciones de lint: 0`.

### Tests

- [ ] T009 [P] [US1] Crear fixtures en `tests/lint/fixtures/` (uno por regla, mínimo, con tipos válidos para que sólo dispare su regla): `no-explicit-any.ts`, `no-unsafe-assignment.ts` (`const x: number = JSON.parse("1")`), `no-unsafe-call.ts`, `no-unsafe-member-access.ts`, `no-floating-promises.ts`, `no-misused-promises.ts` (`if (Promise.resolve(true))`), `no-non-null-assertion.ts`, `switch-exhaustiveness-check.ts`, `consistent-type-imports.ts` (`import { Clock } from "../../../src/ports/clock.js"` usado sólo como tipo), `import-order.ts`, `no-duplicates.ts`, `disable-without-reason.ts` (`// eslint-disable-next-line @typescript-eslint/no-explicit-any` sin `--`), `unused-disable.ts` (directiva sin violación debajo), `ts-expect-error-without-description.ts`, y `valid.ts` (usa todo correctamente).
- [ ] T010 [US1] Crear `tests/lint/lint.test.ts`: `new ESLint({ overrideConfigFile: "eslint.config.mjs", overrideConfig: [{ ignores: [] }] , cwd })` con un `tsconfig.lint-fixtures.json` (extiende `tsconfig.typecheck.json`, `include: ["tests/lint/fixtures"]`) pasado vía `overrideConfig.languageOptions.parserOptions.project`; `it.each` sobre los fixtures afirma que `lintFiles` devuelve al menos un mensaje con el `ruleId` esperado (mapa fixture → regla) y `severity === 2`; `valid.ts` → cero mensajes. Incluir `tests/lint/fixtures/` en `tsconfig.lint-fixtures.json` solamente (no en `tsconfig.typecheck.json`).

### Implementation

- [ ] T011 [US1] Corregir `src/adapters/http/build-server.ts`: tipar el borde con openapi-backend sin `any` (los `c.request.params/query/headers/cookies/requestBody` se toman como `unknown` en un objeto `TypedRequest`-compatible con **un** `as` documentado en comentario, no con `eslint-disable`), `params["additionalProperty"]` según `noPropertyAccessFromIndexSignature`, orden de imports, `restrict-template-expressions`. `npm run arch` sigue en 0.
- [ ] T012 [P] [US1] Corregir `src/main.ts` (`no-confusing-void-expression` en `shutdown`, orden de imports), `src/handlers/health.ts`, `src/handlers/typed.ts` (`consistent-type-definitions`), `src/client/index.ts`, `src/adapters/clock/system-clock.ts`, `src/adapters/http/problem-details.ts` (orden de imports, `dot-notation` si queda).
- [ ] T013 [P] [US1] Corregir pruebas: crear `tests/helpers/json.ts` con `json<T = unknown>(res: LightMyRequestResponse): T` que parsea `res.body` (elimina el `any` de `res.json()`); reemplazar `res.json()` en `tests/integration/server.test.ts` y `mock.test.ts`; quitar el `!` de `healthHandlers.getHealth!` (guardar el handler en una constante tipada); `no-unnecessary-condition` en `tests/contract-diff/diff.test.ts:25` y `tests/unit/contract-types-check.test.ts:24`; `no-unsafe-enum-comparison` en `tests/contract-rules/rules.test.ts` (comparar con `DiagnosticSeverity` importado de `@stoplight/types`); `no-unsafe-assignment` en `tests/types/client.test-d.ts:26` (tipar `uptime` como `unknown` y mantener el `@ts-expect-error`); orden de imports en todos los `tests/**/*.ts`.
- [ ] T014 [US1] `npm run lint:fix` para lo automático (orden, `consistent-type-imports`), luego `npm run lint` → 0 errores y `Excepciones de lint: 0`; `npx vitest run tests/lint` → verde; `npm test` completo → verde sin tocar aserciones (FR-052).

**Checkpoint**: commit `fix(lint): el código pasa strictTypeChecked sin excepciones`.

---

## Phase 5: User Story 3 — Tipos en los scripts JavaScript (Priority: P2)

**Goal**: `tsc -p tsconfig.scripts.json` verde; los scripts no cambian de forma de ejecución.

**Independent Test**: `tests/typecheck/typecheck.test.ts` (parte `checkJs`) en verde; `npm run typecheck` exit 0; `npm run contract:check` sigue en verde.

### Tests

- [ ] T015 [P] [US3] Crear `tests/typecheck/fixtures/bad-script.mjs` (importa `walkFiles` de `../../../scripts/governance-lib.mjs` y accede a `.lenght`) y en `tests/typecheck/typecheck.test.ts` un caso que escribe un `tsconfig` temporal (extiende `tsconfig.scripts.json`, `include` sólo ese fixture más `scripts/governance-lib.mjs`), corre `tsc -p` y afirma exit ≠ 0 con `TS2339` y el nombre del fixture; y un caso que corre `node tests/typecheck/fixtures/bad-script.mjs` y afirma que **ejecuta** (exit 0 o el error de runtime esperado), demostrando que el chequeo no cambia el runtime.

### Implementation

- [ ] T016 [P] [US3] Anotar `scripts/lib.mjs` y `scripts/governance-lib.mjs` con JSDoc completo (firmas de todas las funciones exportadas, `@typedef` para `Outcome` de `capture`, `Frontmatter`, etc.); corregir los hallazgos reales (TS7053 index access, TS18046 `unknown`).
- [ ] T017 [P] [US3] Crear en `contracts/rules/functions/_walk.js` los `@typedef` `SpectralContext` (`{ path: (string|number)[]; rule: { owner: { source: string } }; document: { data: unknown }; documentInventory?: { resolved: unknown } }`), `SpectralResult` (`{ message: string; path?: (string|number)[] }`) y `SpectralFunction`; anotar las 11 funciones (`module.exports = /** @type {SpectralFunction} */ (…)`) y las utilidades `walk`/`walkSchema`; corregir TS7005/TS2322 en `_catalog.js`, `noMerchantIdInRequest.js`.
- [ ] T018 [P] [US3] Anotar los scripts restantes (`contract-*.mjs`, `oasdiff-install.mjs`, `test-contract.mjs`, `check-*.mjs`, `release-check.mjs`) y corregir los hallazgos reales: `server.stdout` posiblemente `null` en `test-contract.mjs` (TS2810), `TS2339` en `check-glossary.mjs` y `check-markers.mjs`, TS7034 de arrays sin tipo (`/** @type {string[]} */`).
- [ ] T019 [P] [US3] Anotar `tests/contract-rules/gen-fixtures.mjs` con `@typedef {Record<string, unknown>} Doc` (o un tipo estructural mínimo con `paths`, `components`, `info`, `tags`) y `/** @type {Record<string, (d: Doc) => Doc>} */` sobre `fixtures`; regenerar los fixtures y confirmar que no cambian (`git status` limpio).
- [ ] T020 [US3] `npm run typecheck` → 0 errores en los dos proyectos; `npm run contract:check` y `npm test` → verde; `npx vitest run tests/typecheck` → verde.

**Checkpoint**: commit `chore(scripts): tipos con JSDoc y checkJs en scripts y funciones del ruleset`.

---

## Phase 6: User Story 4 — Compilador endurecido (Priority: P2)

**Goal**: las cuatro opciones activas; fixtures que fallan con el código esperado; el repo compila.

**Independent Test**: `tests/typecheck/typecheck.test.ts` (parte compilador) en verde; `npm run build` exit 0.

- [ ] T021 [P] [US4] Crear `tests/typecheck/fixtures/index-signature-dot.ts` (`const env: Record<string, string> = {}; export const port = env.PORT;` → TS4111), `side-effect-import.ts` (`import "./no-existe.js";` → TS2307), `erasable-enum.ts` (`export enum Color { Red }` → TS1294) y `valid.ts`; agregar a `tests/typecheck/typecheck.test.ts` un `it.each` que compila cada fixture con un `tsconfig` temporal (extiende `tsconfig.json`, `include` sólo el fixture, `noEmit`) y afirma el código TS esperado; `valid.ts` compila.
- [ ] T022 [US4] Agregar a `tsconfig.json` `noPropertyAccessFromIndexSignature`, `noUncheckedSideEffectImports`, `verbatimModuleSyntax`, `erasableSyntaxOnly`; `npm run build && npm run typecheck && npm test` → verde (el sondeo indica cero errores; si aparece alguno, corregir sin cambiar comportamiento).

**Checkpoint**: commit.

---

## Phase 7: User Story 5 — Hook de pre-commit (Priority: P3)

**Goal**: commit rechazado ante formato/lint/tipos inválidos; instalado con `npm install`; < 15 s.

**Independent Test**: `tests/hooks/lefthook.test.ts` en verde; prueba manual del quickstart §6.

- [ ] T023 [P] [US5] Crear `tests/hooks/lefthook.test.ts`: parsea `lefthook.yml` con `yaml`; afirma `pre-commit.parallel === true`, jobs con nombres `format`, `lint`, `typecheck`, que `format` y `lint` usan `{staged_files}` con los globs de data-model.md, y que ningún `run` contiene `contract:check`, `npm test`, `vitest` ni `test:contract` (FR-040).
- [ ] T024 [US5] Crear `lefthook.yml` (`pre-commit: parallel: true; jobs: format → prettier --check {staged_files} glob "*.{ts,mts,cts,js,mjs,cjs,json,yaml,yml,md}"; lint → eslint {staged_files} glob "*.{ts,mts,cts,js,mjs,cjs}"; typecheck → npm run typecheck`), verificar que `npx lefthook install` deja `.git/hooks/pre-commit`, y ejecutar la prueba manual de quickstart §6 (archivo mal formateado → commit rechazado; corregido → pasa; medir tiempo < 15 s).

**Checkpoint**: commit.

---

## Phase 8: Polish

- [ ] T025 [P] Agregar a `.github/workflows/ci.yml` los pasos `npm run format:check` y `npm run lint` después de `contract:check` y antes de `build`.
- [ ] T026 [P] Crear `docs/adr/011-lint-y-formato.md` (ESLint + typescript-eslint estricto con tipos, Prettier como único formateador, lefthook; `require-await` apagada y por qué; reglas de import-x limitadas a orden) y `docs/adr/012-compilador-y-tipos-en-scripts.md` (opciones endurecidas, `checkJs` con JSDoc en vez de migrar; `erasableSyntaxOnly` como preparación para correr sin transpilar), ambos `estado: aceptada`, `fuente: specs/003-calidad-de-codigo/research.md`; citar ADR-011/012 desde research.md. `npm run check:adrs` en verde.
- [ ] T027 [P] Actualizar `CLAUDE.md`: comandos `lint`, `lint:fix`, `format`, `format:check` en la tabla; paso 5 del orden de trabajo pasa a `npm run format:check && npm run lint && npm run typecheck && npm run arch && npm test && npm run test:contract`; sección "Tipado" (sin `any` ni `!`; excepción inline con `-- motivo`; scripts JS con JSDoc; `erasableSyntaxOnly`: sin `enum`, uniones de literales); nota de que el hook corre formato/lint/typecheck y CI el resto. Actualizar `README.md` (comandos) y `.vscode/settings.json` (`editor.defaultFormatter: esbenp.prettier-vscode`, `editor.formatOnSave: true`, `eslint.validate` para ts/js; `extensions.json` con `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`, `editorconfig.editorconfig`).
- [ ] T028 Correr `quickstart.md` §1–§7, medir SC-002 (`format:check` + `lint` + `typecheck`) y el hook, completar la tabla "Estado al cierre" con fecha y evidencia, marcar tareas y commit final.

---

## Dependencies & Execution Order

```
Fase 1 → Fase 2 → US2 (formato, commit aislado) → US1 (lint) → US3 (checkJs) → US4 (compilador) → US5 (hook) → Polish
```

- US2 antes que US1 para que el commit de formato no se mezcle con correcciones semánticas.
- US1 antes que US3: las correcciones de lint en scripts (orden de imports) y las anotaciones JSDoc tocan los mismos archivos; se hacen en ese orden para no pisarse.
- US4 después de US1/US3: `noPropertyAccessFromIndexSignature` cambia qué reporta `dot-notation`; se activa con el código ya limpio (el sondeo dice que compila igual).
- US5 al final: el hook exige que `format:check`, `lint` y `typecheck` ya estén en verde.

### Parallel Opportunities

- Fase 1: T002, T003 con T001. Fase 2: T006 con T004/T005.
- US1: T009 con T010 (fixtures y prueba); T012 y T013 en paralelo tras T011.
- US3: T016–T019 en paralelo (archivos disjuntos).
- Polish: T025–T027 en paralelo.

## Implementation Strategy

MVP = US2 + US1 (formato y lint verdes, cero excepciones). US3 es el mayor esfuerzo (JSDoc
sobre ~1.800 líneas) y se hace archivo por archivo con `tsc -p tsconfig.scripts.json` como
guía. Cada fase termina con `npm test` en verde y un commit.

## Notes

- Ninguna corrección de lint puede cambiar una aserción de prueba existente (FR-052); si una
  regla obliga a reescribir una prueba, se reescribe la forma, no lo que afirma.
- Objetivo SC-003: `Excepciones de lint: 0`. Si una excepción resulta inevitable, va inline
  con `-- motivo` y se menciona en la tabla de cierre del quickstart.
