# Implementation Plan: Calidad de código — tipado fuerte verificable, lint y formato

**Branch**: `003-calidad-de-codigo` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-calidad-de-codigo/spec.md`

## Summary

Hacer verificable por herramienta lo que la guía de agentes ya exige: TypeScript fuertemente
tipado (ESLint 10 + typescript-eslint en modo estricto con tipos, compilador endurecido,
`checkJs` con JSDoc sobre los scripts), un único formato (Prettier) verificado en CI, y un
hook de pre-commit (lefthook). Cada regla clave con un fixture que la viola; cero cambios de
comportamiento. Evidencia y decisiones en [research.md](research.md); el sondeo sobre el
código actual dio 76 hallazgos de lint (todos corregibles sin excepciones), 83 archivos por
formatear y 219 diagnósticos de `checkJs` (la mayoría anotaciones JSDoc), y el compilador
endurecido compila el repo sin errores.

## Technical Context

**Language/Version**: Node.js 22, TypeScript 5.9.3 (sin cambio)

**Primary Dependencies** (dev, nuevas): `eslint@^10.10`, `typescript-eslint@^8.70`,
`@eslint/js@^10`, `globals@^17`, `eslint-plugin-import-x@^4.17`,
`@eslint-community/eslint-plugin-eslint-comments@^4.8`, `eslint-config-prettier@^10`,
`prettier@^3.9`, `lefthook@^2.1`. Sin dependencias de runtime nuevas.

**Storage**: N/A

**Testing**: Vitest; fixtures por regla en `tests/lint/`, `tests/format/`,
`tests/typecheck/`, `tests/hooks/`

**Target Platform**: Windows/macOS dev, Linux CI; hook multiplataforma

**Project Type**: toolchain de calidad sobre el backend existente

**Performance Goals**: `lint` + `format:check` + `typecheck` < 60 s (SC-002); hook < 15 s

**Constraints**: cero cambios de comportamiento (FR-052); el linter no formatea (FR-004);
scripts JS no cambian de forma de ejecución (FR-020); fixtures y generados excluidos en una
lista única (FR-011)

**Scale/Scope**: 1 config de ESLint, 1 de Prettier, 2 tsconfig (uno nuevo), 1 lefthook.yml,
`.editorconfig`, ~76 correcciones de lint, ~55 correcciones + anotaciones JSDoc en ~20
archivos JS, un commit de formato sobre ~80 archivos, ~12 fixtures con prueba, 2 ADRs

## Constitution Check

| Gate | ¿Aplica? | Cómo se cumple |
|---|---|---|
| Superficie HTTP | No | Sin cambios en `contracts/`; `contract:diff` sin diferencias |
| Persistencia / API → aislamiento por merchant | No | Sin cambios de API; las pruebas existentes se mantienen |
| Plano de decisión / ledger / campos / LLM | No | — |
| Regla de negocio no expresable por esquema (`x-invariants`) | No | — |
| Sustantivo nuevo en el contrato (glosario) | No | — |
| Toca `src/` → dirección de dependencias | **Sí** | Correcciones de lint dentro de cada archivo, sin imports nuevos entre capas; `npm run arch` sigue en 0 |

Principio "una regla sin verificación es decorativa" (ADR-009): esta feature lo aplica a
"TypeScript `strict`. Sin `any`" de CLAUDE.md. **Resultado pre-Phase 0**: PASA.
**Post-Phase 1**: PASA.

## Project Structure

### Documentation (this feature)

```text
specs/003-calidad-de-codigo/
├── plan.md, spec.md, research.md, data-model.md, quickstart.md
├── checklists/requirements.md
└── tasks.md
```

(sin `contracts/`: no hay interfaz externa nueva)

### Source Code (repository root) — lo nuevo

```text
eslint.config.mjs                 # flat config: js recommended + strictTypeChecked + stylisticTypeChecked + import-x (order) + eslint-comments + prettier
.prettierrc.json / .prettierignore
.editorconfig
lefthook.yml                      # pre-commit: prettier --check, eslint, typecheck (sin contract:check ni test)
tsconfig.json                     # + noPropertyAccessFromIndexSignature, noUncheckedSideEffectImports, verbatimModuleSyntax, erasableSyntaxOnly
tsconfig.typecheck.json           # + vitest.config.ts, eslint.config.mjs en include
tsconfig.scripts.json             # allowJs + checkJs: scripts/**, contracts/rules/functions/*, gen-fixtures.mjs, .dependency-cruiser.cjs
scripts/check-lint-exceptions.mjs # cuenta eslint-disable vigentes (FR-003)
docs/adr/011-lint-y-formato.md, 012-compilador-y-tipos-en-scripts.md
tests/
├── lint/fixtures/*.ts, lint.test.ts          # una violación por regla clave
├── format/format.test.ts                     # falla / corrige / idempotente
├── typecheck/fixtures/*.ts|*.mjs, typecheck.test.ts   # TS4111, TS2307, TS1294, TS2339
└── hooks/lefthook.test.ts                    # config parsea, jobs esperados, sin contract:check/test
```

### Comandos npm

| Comando | Qué hace |
|---|---|
| `lint` | `eslint .` + `node scripts/check-lint-exceptions.mjs` |
| `lint:fix` | `eslint . --fix` |
| `format` | `prettier --write .` |
| `format:check` | `prettier --check .` |
| `typecheck` | `tsc -p tsconfig.typecheck.json && tsc -p tsconfig.scripts.json` |
| CI | `format:check` y `lint` después de `contract:check`, antes de `build` |

## Diseño de los puntos no triviales

- **Orden de commits para que el diff sea revisable**: (1) configuración + fixtures + pruebas
  (rojas donde corresponde); (2) `chore: formato` — sólo Prettier, sin cambios semánticos;
  (3) `fix(lint)` — las 76 correcciones; (4) `chore(scripts)` — JSDoc y correcciones de
  `checkJs`; (5) compilador endurecido + hook + CI + guía + ADRs.
- **`require-await` apagada** (research R-01) con la justificación en el config; el resto de
  `strictTypeChecked` queda intacto.
- **Bordes con `any`**: openapi-backend expone `Context.request.*` como `any`. Se tipa el
  borde una sola vez en `build-server.ts` (`unknown` + el cast al `TypedRequest` que ya
  existe), y en las pruebas un helper `json<T>(res)` reemplaza `res.json()` (que devuelve
  `any`). Ningún `eslint-disable`.
- **`checkJs`**: typedef `SpectralFunction` en `_walk.js` para las 11 funciones del ruleset;
  typedef `Doc`/`Mutator` en `gen-fixtures.mjs`; firmas JSDoc en `governance-lib.mjs` y
  `lib.mjs`. Las utilidades comparten tipos por `@typedef` importables (`@import`), no por
  duplicación.

## Complexity Tracking

| Elemento | Por qué | Alternativa rechazada |
|---|---|---|
| Un `tsconfig` más (`tsconfig.scripts.json`) | los scripts no son parte del build de `src/` y necesitan `allowJs`/`checkJs` | meterlos en `tsconfig.typecheck.json` mezclaría `include` de fuentes y generaría tipos JS en `dist` |
| Reglas de import-x limitadas a orden/duplicados | las de resolución dan falsos positivos sin resolver extra y duplican a `tsc` | instalar `eslint-import-resolver-typescript`: más lento y redundante |

## Re-evaluación del Constitution Check (post-Phase 1)

Sin contrato ni dominio nuevos; `arch` sin cambios; comportamiento intacto por FR-052.
**PASA.**
