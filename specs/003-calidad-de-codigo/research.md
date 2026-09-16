# Research — Feature 003: calidad de código

**Fecha**: 2026-09-16 · **Estado**: completo. Las decisiones transversales se registran como
ADR-011 (lint y formato) y ADR-012 (compilador y scripts) durante la implementación.

## R-01 Linter → ESLint 10 + typescript-eslint 8 (`strictTypeChecked` + `stylisticTypeChecked`)

- **Decisión (DECIDIDO → ADR-011)**: `eslint@^10.10`, `typescript-eslint@^8.70`
  (peer `typescript >=4.8.4 <6.1.0`: compatible con 5.9.3 y con una futura 6.0), flat config
  en `eslint.config.mjs`, `@eslint/js` recommended + `strictTypeChecked` + `stylisticTypeChecked`,
  `eslint-plugin-import-x@^4.17` **sólo** para `order`, `no-duplicates` (`prefer-inline`) y
  `first`, y `eslint-config-prettier` al final para apagar toda regla de formato (FR-004).
- **Por qué no Biome**: sin reglas _type-aware_; no puede prohibir valores `any`, promesas
  flotantes ni `switch` no exhaustivo, que son el núcleo de FR-001.
- **Por qué no las reglas de resolución de import-x** (`no-unresolved`, `namespace`,
  `default`, `no-named-as-default*`): en el sondeo produjeron 173 falsos positivos porque no
  resuelven `.js` → `.ts` ni `node:` sin un resolver adicional, y `tsc` ya garantiza que todo
  import resuelve. Quedan sólo las reglas de orden y duplicados, que no necesitan resolver.
- **Tipos para tests**: `parserOptions.project: ["./tsconfig.typecheck.json"]`, que incluye
  `src/` y `tests/`; `vitest.config.ts` se agrega a ese `include`. JS (`scripts/`, funciones
  del ruleset, `*.cjs`) se lintea sin información de tipos (`disableTypeChecked`), con
  `sourceType: commonjs` y `no-require-imports` apagado para las funciones de Spectral (son
  CommonJS por diseño, ADR-004).
- **Sondeo sobre el código actual** (ESLint 10.10.0, typescript-eslint 8.70.0, 6 s): **76
  hallazgos**, todos legítimos o de política:

  | Regla                                                                                                                                                                                                                      | Cant. | Qué es                                                                                                            | Decisión                                                                                                                                                                       |
  | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `require-await`                                                                                                                                                                                                            | 17    | handlers `async` sin `await` (la firma exige `Promise`)                                                           | **Apagar** con justificación: `async` como conformidad de interfaz es idiomático; la seguridad real la dan `no-floating-promises` y `no-misused-promises`, que quedan en error |
  | `import-x/order`                                                                                                                                                                                                           | 16    | orden de imports                                                                                                  | corregir con `--fix`                                                                                                                                                           |
  | `no-unsafe-assignment` / `-member-access` / `-call`                                                                                                                                                                        | 14    | `any` que entra desde openapi-backend (`Context.request.*`) y desde `res.json()` de Fastify inject en las pruebas | corregir: tipar el borde (`unknown` + narrowing) y un helper `json<T>()` en las pruebas. Es exactamente lo que la feature existe para atrapar                                  |
  | `dot-notation`                                                                                                                                                                                                             | 7     | `env["PORT"]`, `params["additionalProperty"]`                                                                     | desaparece al activar `noPropertyAccessFromIndexSignature` (la regla respeta esa opción)                                                                                       |
  | `restrict-template-expressions`                                                                                                                                                                                            | 5     | interpolar `number`/`unknown` en plantillas                                                                       | corregir con `String()` o permitir `number` (`allowNumber: true`)                                                                                                              |
  | `no-unnecessary-condition`                                                                                                                                                                                                 | 4     | `??` sobre valores no nulos                                                                                       | corregir                                                                                                                                                                       |
  | `no-confusing-void-expression`, `no-meaningless-void-operator`, `no-unsafe-enum-comparison`, `consistent-type-definitions`, `no-unnecessary-type-assertion`, `prefer-includes`, `no-regex-spaces`, `no-non-null-assertion` | 12    | varios                                                                                                            | corregir uno a uno                                                                                                                                                             |

  Ninguno requiere `eslint-disable`; el objetivo SC-003 es **cero excepciones** al cierre.

- **Excepciones** (FR-002, FR-003): `linterOptions.reportUnusedDisableDirectives: "error"`
  (core de ESLint) falla ante un `eslint-disable` que ya no aplica;
  `@eslint-community/eslint-plugin-eslint-comments` con `require-description` falla ante
  un `eslint-disable` sin `-- motivo`; typescript-eslint `ban-ts-comment` exige descripción en
  `@ts-expect-error` (los de `tests/types/*.test-d.ts` ya la llevan). El conteo de excepciones
  vigentes lo imprime `scripts/check-lint-exceptions.mjs` (busca `eslint-disable` fuera de
  fixtures) al final de `npm run lint`.

## R-02 Formateador → Prettier 3

- **Decisión (DECIDIDO → ADR-011)**: `prettier@^3.9`, `.prettierrc.json` con `printWidth: 110`,
  comillas dobles, punto y coma, `trailingComma: all`, `endOfLine: lf`, `proseWrap: preserve`
  (no reflowea la prosa de specs y ADRs). `.prettierignore` = lista única de exclusiones
  (FR-011): `dist`, `node_modules`, `src/generated`, `contracts/dist`, `docs/api`,
  `.schemathesis`, `package-lock.json`, los tres directorios de fixtures, y **`.specify/` y
  `.claude/`** (plantillas y skills de Spec Kit sin modificar, por decisión de la 001).
- **Sondeo**: 83 archivos difieren hoy (38 md, 15 ts, 13 mjs, 7 js, 6 json, 3 yaml, 1 cjs),
  3 s. En Markdown los cambios son cosméticos (`*x*` → `_x_`, alineación de tablas). Se aplica
  en un único commit "chore: formato" separado de las correcciones de lint, para que el diff
  de comportamiento sea revisable.
- `format:check` = `prettier --check .`; `format` = `prettier --write .`. Idempotencia
  verificada por prueba (FR-012).

## R-03 Tipos en JavaScript → `checkJs` con JSDoc

- **Decisión (DECIDIDO → ADR-012)**: `tsconfig.scripts.json` con `allowJs`, `checkJs`,
  `noEmit`, `strict`, `noUncheckedIndexedAccess`, `types: ["node"]`, incluyendo
  `scripts/**/*.mjs`, `contracts/rules/functions/*.js`, `tests/contract-rules/gen-fixtures.mjs`
  y `.dependency-cruiser.cjs`. `npm run typecheck` corre los dos proyectos.
- **Sondeo**: 219 diagnósticos, 162 de ellos TS7006 (parámetro implícitamente `any`), que se
  resuelven con `@typedef` compartidos: uno para las funciones de Spectral (`(input, options,
context)`) en `_walk.js`, uno para los mutadores del generador de fixtures (`(d: Doc) =>
Doc`, anotando el objeto `fixtures` una sola vez), y firmas JSDoc en `governance-lib.mjs` y
  `lib.mjs`. Los ~55 restantes son hallazgos reales (TS2339 propiedad inexistente, TS18046
  `unknown`, TS2810 `stdout` posiblemente `null` en `test-contract.mjs`) — el valor de la
  feature. Estimación: 2–3 h.
- **Alternativa rechazada**: migrar a `.ts` y correr con `tsx`/`node --strip-types`: cambia
  cómo arrancan los scripts en CI (US3 escenario 3) por la misma verificación.

## R-04 Compilador endurecido

- **Decisión (DECIDIDO → ADR-012)**: agregar a `tsconfig.json`
  `noPropertyAccessFromIndexSignature`, `noUncheckedSideEffectImports`, `verbatimModuleSyntax`,
  `erasableSyntaxOnly`. **Sondeo: el repo compila con las cuatro sin ningún error** (TS
  5.9.3). `erasableSyntaxOnly` prohíbe `enum`, `namespace` con valores y parámetros de
  propiedad; el código no los usa y no los va a usar (uniones de literales en su lugar).
  Fixtures de US4 en `tests/typecheck/fixtures/` verificados por una prueba que corre `tsc`
  sobre cada uno y espera el código de error (TS4111, TS2307, TS1294).

## R-05 Hook de pre-commit → lefthook 2

- **Decisión (DECIDIDO → ADR-011)**: `lefthook@^2.1`. Su `postinstall` instala los hooks
  al hacer `npm install` (verificado: creó `.git/hooks/prepare-commit-msg` y un
  `lefthook.yml` de ejemplo). `lefthook.yml` con `pre-commit` en paralelo: `prettier --check
{staged_files}` (glob de los cinco tipos), `eslint {staged_files}` (ts/js), y `typecheck`
  completo (no hay modo parcial que valga). Sin `contract:check` ni `test` (FR-040).
  `git commit --no-verify` sigue disponible; CI es la puerta.
- **Por qué no husky + lint-staged**: dos paquetes y un script de `prepare`; lefthook trae el
  filtrado de staged, paralelismo y la instalación automática en uno.

## R-06 `.editorconfig`

- `root = true`, `indent_style = space`, `indent_size = 2`, `end_of_line = lf`,
  `charset = utf-8`, `insert_final_newline = true`, `trim_trailing_whitespace = true`
  (`false` para `*.md`). Coincide con Prettier y `.gitattributes`.

## R-07 Pruebas de la feature (FR-051)

| Qué                                                                                                                                                                                                               | Cómo                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reglas de lint clave (`no-explicit-any`, `no-unsafe-*`, `no-floating-promises`, `no-non-null-assertion`, `switch-exhaustiveness-check`, `consistent-type-imports`, `import-x/order`, `eslint-disable` sin motivo) | `tests/lint/fixtures/*.ts` con una violación cada uno; `tests/lint/lint.test.ts` corre ESLint por API (`new ESLint({ overrideConfigFile })`) sobre el fixture y afirma el `ruleId`. Los fixtures están en `.prettierignore` y en `ignores` del config real; la prueba los lintea con un config que quita esa exclusión |
| Formato                                                                                                                                                                                                           | `tests/format/format.test.ts`: archivo temporal mal formateado → `prettier --check` falla; `--write` → pasa; segunda pasada no cambia nada                                                                                                                                                                             |
| `checkJs`                                                                                                                                                                                                         | `tests/typecheck/fixtures/bad-script.mjs` (propiedad inexistente) → `tsc -p` con un tsconfig temporal que lo incluye falla con TS2339                                                                                                                                                                                  |
| Compilador                                                                                                                                                                                                        | fixtures TS con cada patrón → `tsc` falla con el código esperado                                                                                                                                                                                                                                                       |
| Hook                                                                                                                                                                                                              | `tests/hooks/lefthook.test.ts`: `lefthook.yml` parsea, declara `pre-commit` con los tres jobs y ninguno invoca `contract:check`/`test` (verificación estática; ejecutar git hooks en la prueba sería frágil)                                                                                                           |

## R-08 Tiempo

Sondeo: lint 6 s, prettier 3 s, typecheck actual ~8 s; con `tsconfig.scripts.json` estimado
+3 s. Total < 60 s (SC-002). Hook sobre pocos archivos: prettier y eslint sobre staged < 5 s +
typecheck ~10 s → < 15 s.
