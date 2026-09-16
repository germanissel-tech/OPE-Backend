# Data model — Feature 003

Sin datos de dominio. Entidades = configuraciones y sus invariantes.

## Regla de lint (`eslint.config.mjs`)

| Campo            | Regla                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| id               | `<plugin>/<regla>`; severidad siempre `error` (no hay `warn`)                                                       |
| alcance          | `src/`, `tests/`, `scripts/`, `contracts/rules/functions/`, `*.mjs`/`*.cjs` de la raíz; JS sin información de tipos |
| excluidos        | `dist/`, `node_modules/`, `src/generated/`, `contracts/dist/`, `docs/api/`, `tests/**/fixtures/`                    |
| excepción inline | `// eslint-disable-next-line <regla> -- <motivo>`; sin motivo ⇒ error; sin uso ⇒ error                              |
| formato          | ninguna regla de formato activa (`eslint-config-prettier` al final)                                                 |

Reglas fijadas por la spec: `no-explicit-any`, `no-unsafe-{assignment,member-access,call,return,argument}`,
`no-floating-promises`, `no-misused-promises`, `no-non-null-assertion`,
`switch-exhaustiveness-check`, `consistent-type-imports` (inline), `import-x/order`,
`import-x/no-duplicates`, `import-x/first`, `eslint-comments/require-description`,
`ban-ts-comment` (`allow-with-description`). Apagada con justificación: `require-await`.

## Configuración de formato (`.prettierrc.json`, `.prettierignore`)

`printWidth 110`, comillas dobles, punto y coma, `trailingComma all`, `endOfLine lf`,
`proseWrap preserve`. Exclusiones (lista única): generados, fixtures, `package-lock.json`,
`.specify/`, `.claude/`.

## Proyectos del compilador

| Archivo                   | Incluye                                                                                                                  | Opciones clave                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `tsconfig.json`           | `src/`                                                                                                                   | base + `noPropertyAccessFromIndexSignature`, `noUncheckedSideEffectImports`, `verbatimModuleSyntax`, `erasableSyntaxOnly`; emite a `dist/` |
| `tsconfig.typecheck.json` | `src/`, `tests/`, `vitest.config.ts`, `eslint.config.mjs`                                                                | extiende el anterior; `noEmit`                                                                                                             |
| `tsconfig.scripts.json`   | `scripts/**/*.mjs`, `contracts/rules/functions/*.js`, `tests/contract-rules/gen-fixtures.mjs`, `.dependency-cruiser.cjs` | `allowJs`, `checkJs`, `strict`, `noUncheckedIndexedAccess`, `noEmit`                                                                       |

## Hook (`lefthook.yml`)

`pre-commit`, jobs en paralelo: `format` (`prettier --check {staged_files}` sobre
`*.{ts,mts,cts,js,mjs,cjs,json,yaml,yml,md}`), `lint` (`eslint {staged_files}` sobre
`*.{ts,mts,cts,js,mjs,cjs}`), `typecheck` (`npm run typecheck`). Prohibido: `contract:check`,
`test`, `test:contract`. Instalación: `postinstall` de lefthook.

## Excepción justificada

Línea, regla, motivo. Contadas por `scripts/check-lint-exceptions.mjs` (salida
`Excepciones de lint: N`). Objetivo al cierre: 0.
