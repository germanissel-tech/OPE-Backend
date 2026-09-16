# Implementation Plan: Auditoría de calidad y arquitectura — gates deterministas, auditoría verificable e idioma del código

**Branch**: `005-auditoria-calidad` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-auditoria-calidad/spec.md`

## Summary

Cuatro bloques sobre el toolchain existente. Primero (D) el compilador pasa a TypeScript 7
con la API 6.0 side-by-side que Microsoft documenta para las herramientas que la importan
(ADR-017), y toda dependencia queda en su última versión publicada. Después: (A) todo lo que lee un
desarrollador o un consumidor de la API pasa a inglés, con `check:language` (lista curada de
palabras funcionales + caracteres del español, sobre comentarios y strings) que lo hace
cumplir; (B) gates nuevos bloqueantes en CI, cada uno con fixture: forma del código
(`eslint-plugin-sonarjs` + reglas core), duplicación estructural (jscpd), código muerto
(knip), mutación sobre el diff contra `main` (Stryker sobre Vitest 5, con el runner
parcheado localmente por stryker-js#6210) y forma de los anillos (`shape.test.ts`); un `npm run quality` que los
encadena; (C) skill `auditing-architecture` con criterios de diseño escritos en términos del
repo, hallazgos verificados por script y estado global derivado. Evidencia y decisiones en
[research.md](research.md); el sondeo dio ~1.090 líneas en español en 183 archivos, 0
violaciones de complejidad, 5 funciones largas, 14 números mágicos, 1 clon real, 20 exports
sin uso y 87,5 % de mutación en el archivo de dominio sondeado.

## Technical Context

**Language/Version**: Node.js 22; **TypeScript 7.0 como compilador** (`@typescript/native` =
`npm:typescript@^7.0`) y **API 6.0** para las herramientas (`typescript` =
`npm:@typescript/typescript6@^6.0`), R-10 / ADR-017

**Primary Dependencies** (dev, nuevas): `eslint-plugin-sonarjs@^4.2`, `jscpd@^5.2`,
`knip@^6.36`, `@stryker-mutator/core@^10`, `@stryker-mutator/vitest-runner@^10`,
`@stryker-mutator/typescript-checker@^10`, `@stoplight/spectral-parsers` (hoy transitiva,
importada directamente), `patch-package` (aplica en `postinstall` el fix de
stryker-js#6214 al runner, R-05). Vitest sigue en `^5.0`. `npm update` para `openapi-backend`,
`cross-env` y `tsx` (dentro de rango). Sin dependencias de runtime nuevas.

**Storage**: N/A

**Testing**: Vitest 5; fixtures por regla en `tests/lint/`, `tests/architecture/`,
`tests/governance/`, `tests/audit/`; Stryker sobre `src/` sin `generated/`, `composition/`,
`main.ts` ni archivos sólo de tipos

**Target Platform**: Windows/macOS dev, Linux CI

**Project Type**: toolchain de calidad + skill de agente sobre el backend existente

**Performance Goals**: `quality` < 3 min local (sondeo: < 1 min); `test:mutation` sobre un
diff de 200 líneas < 10 min en CI (sondeo: ~1,4 s/mutante → 3–4 min) (SC-003)

**Constraints**: sin cambios de comportamiento del servidor (FR-052); contrato traducido
compatible (FR-005, SC-007); exclusiones en una lista única (`.prettierignore`, FR-004);
cada umbral con justificación (FR-013); cero excepciones sin motivo (FR-052)

**Scale/Scope**: cambio de compilador (2 alias en `package.json`, 5 correcciones de `checkJs`,
1 fixture de código de diagnóstico); ~1.090 líneas a traducir en 183 archivos; 1 config de ESLint ampliada;
`knip.json`, `stryker.config.json`, `scripts/language-denylist.json`; 5 scripts nuevos
(`check-language`, `check-duplication`, `check-dead-code`, `mutation-diff`, `quality`);
`shape.test.ts` + 3 fixtures; `tests/audit/` + 3 fixtures de evaluación; skill con 3
referencias, 2 scripts y 3 evals; ~14 constantes con nombre, 1 helper, `buildServer`
partido, ~20 exports revisados; 3 ADRs; `CLAUDE.md` y CI

## Constitution Check

| Gate                                                        | ¿Aplica? | Cómo se cumple                                                                                                                                                                                                          |
| ----------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Superficie HTTP                                             | **Sí**   | Sólo `description`/`summary`/`title`/mensajes cambian de idioma; ninguna ruta, schema ni código. Diseño en [contracts/README.md](contracts/README.md); `contract:diff` sin cambios rompientes; `info.version` no cambia |
| Persistencia / API → aislamiento por merchant               | No       | Sin cambio de API ni de persistencia; las pruebas de aislamiento existentes se mantienen (se traducen sus nombres, no sus aserciones)                                                                                   |
| Plano de decisión                                           | No       | Sin cambio de comportamiento; refactors internos (partir `buildServer`, helper 422, constantes) sin I/O nuevo                                                                                                           |
| Ledger / cadena de evidencia / campos nuevos / LLM          | No       | —                                                                                                                                                                                                                       |
| Regla de negocio no expresable por esquema (`x-invariants`) | No       | —                                                                                                                                                                                                                       |
| Sustantivo nuevo en el contrato (glosario)                  | No       | Las notas de `docs/dominio/` siguen en español; el campo `en` no cambia                                                                                                                                                 |
| Toca `src/` → dirección de dependencias                     | **Sí**   | Helper 422 vive en `interface-adapters/http/` (mismo anillo que los controllers); constantes de tiempo en `domain/shared-kernel`; `npm run arch` sigue en 0                                                             |

Principio "una regla sin verificación es decorativa" (ADR-009): esta feature lo aplica a la
forma del código, la duplicación, el código muerto, las pruebas y el idioma.
**Resultado pre-Phase 0**: PASA. **Post-Phase 1**: PASA.

## Project Structure

### Documentation (this feature)

```text
specs/005-auditoria-calidad/
├── plan.md, spec.md, research.md, data-model.md, quickstart.md
├── contracts/
│   ├── README.md                    # cambio al OpenAPI: sólo idioma; cómo se verifica
│   └── audit-finding.schema.json    # forma de un hallazgo de auditoría (lo valida verify-finding)
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root) — lo nuevo o modificado

```text
package.json                      # typescript→@typescript/typescript6, @typescript/native→typescript@7; devDeps nuevas; postinstall patch-package; scripts quality, check:*, test:mutation
patches/@stryker-mutator+vitest-runner+10.0.0.patch   # fix de stryker-js#6214 (separador ' > ' de Vitest 5); se borra con el release
eslint.config.mjs                 # + sonarjs, max-depth/params/lines-per-function (off en tests), no-magic-numbers (src)
knip.json                         # entradas, ignore, ignoreDependencies/ignoreBinaries con motivo
stryker.config.json               # runner vitest, checker typescript, ignorePatterns, reporters
.prettierignore                   # + scripts/language-denylist.json, tests/audit/fixtures, .claude/skills/*/evals
scripts/
├── language-denylist.json        # palabras funcionales del español (lista única)
├── check-language.mjs            # comentarios y strings en español → falla; `lang:es -- motivo`
├── check-duplication.mjs         # jscpd: src bloqueante; tests+scripts informativo
├── check-dead-code.mjs           # knip: files/exports/deps bloqueante; types informativo
├── mutation-diff.mjs             # git diff → rangos mutate → stryker break 100; --all para el sweep
└── quality.mjs                   # lint → arch → duplication → dead-code → language; nombra el rojo
src/
├── domain/shared-kernel/time.ts  # MS_PER_SECOND, minutes(), hours() (números mágicos)
├── interface-adapters/http/problem-details.ts   # + invariantResponse() (clon 422)
├── infrastructure/http/build-server.ts          # buildServer partido (< 60 líneas por función)
└── (todo src/) comentarios, strings y logs en inglés; exports sin uso quitados
contracts/                        # descriptions, summaries, problem-types, no-op-reasons, mensajes de reglas en inglés
tests/
├── lint/fixtures/*.ts, lint.test.ts             # + una violación por regla de R-02
├── governance/fixtures/language/*, language.test.ts   # acentos, palabras, excepción con/sin motivo, YAML
├── governance/duplication.test.ts, dead-code.test.ts, mutation-diff.test.ts   # fixtures + rangos
├── architecture/shape.test.ts, fixtures/shape/  # tamaño, controller por operación, new fuera de composición
└── audit/audit.test.ts, fixtures/               # run-gates reporta los 3 evals; verify-finding acepta/rechaza
.claude/skills/auditing-architecture/
├── SKILL.md
├── references/criterios-diseno.md, formato-hallazgo.md, refutacion.md
├── scripts/run-gates.mjs, verify-finding.mjs
└── evals/{controller-instantiates-infra,identical-domain-functions,empty-catch}/{fixture, expected.json}
.github/workflows/ci.yml          # + quality, test:mutation; job programado de mutación completa
docs/adr/015-idioma-del-codigo-y-del-contrato.md, 016-gates-de-calidad.md, 017-typescript-7-con-api-6.md  # creados en `propuesta`; pasan a `aceptada` al cierre
tests/typecheck/typecheck.test.ts  # TS2307 → TS2882 (código vigente en TS 7)
.dependency-cruiser.cjs, contracts/rules/functions/required*.js   # correcciones de checkJs con tsc 7
CLAUDE.md                         # regla de idioma; comandos nuevos; `Lint exceptions: N`
```

### Comandos npm

| Comando             | Qué hace                                                                          |
| ------------------- | --------------------------------------------------------------------------------- |
| `check:language`    | `node scripts/check-language.mjs` (también dentro de `contract:check`)            |
| `check:duplication` | `node scripts/check-duplication.mjs`                                              |
| `check:dead-code`   | `node scripts/check-dead-code.mjs`                                                |
| `quality`           | `lint` → `arch` → `check:duplication` → `check:dead-code` → `check:language`      |
| `test:mutation`     | `node scripts/mutation-diff.mjs` (diff contra `origin/main`; `-- --all` completo) |
| CI                  | `quality` tras `lint`; `test:mutation` tras `test`; job `mutation-full` semanal   |

## Diseño de los puntos no triviales

- **Orden de commits** (R-09): (0) TypeScript 7 + API 6.0 + correcciones de `checkJs` +
  fixture `TS2882` + `npm update` + ADR-017; (1) contrato en inglés + tipos regenerados + réplica +
  pruebas de texto; (2) `src/` en inglés; (3) `tests/` en inglés; (4) `scripts/`, configs y CI
  en inglés + `check:language` + fixtures + `CLAUDE.md` (idioma) + ADR-015; (5) sonarjs y
  reglas de forma + fixtures + correcciones (`buildServer`, `max-depth`, constantes);
  (6) jscpd + helper 422; (7) knip + limpieza de exports + `spectral-parsers`; (8) Stryker +
  parche del runner + `mutation-diff` + CI; (9) `shape.test.ts` + `quality` + guía + ADR-016;
  (10) skill + evals + `tests/audit/`.
- **`check-language` sobre TS/JS**: tokeniza con `ts.createScanner` y examina sólo
  `SingleLineCommentTrivia`, `MultiLineCommentTrivia`, `StringLiteral`,
  `NoSubstitutionTemplateLiteral` y las partes de template; identificadores nunca. YAML/JSON:
  línea entera. Excepción: `lang:es -- motivo` en la línea o la anterior.
- **`mutation-diff`**: `git diff --unified=0 <base>...HEAD -- src` → por archivo, hunks
  `+inicio,largo` → `mutate: ["src/x.ts:inicio-fin"]`; descarta archivos de `ignorePatterns`;
  sin rangos ⇒ "no production lines changed" y exit 0; sin base ⇒ "no base ref" y exit 0.
  `--all` ignora el diff y muta todo lo permitido con `thresholds.break` sin definir
  (informativo). Un rango nuevo de líneas en un archivo ya existente sólo muta esas líneas:
  los 3 sobrevivientes actuales de `batch.ts` no bloquean hasta que alguien toque esas líneas.
- **`shape.test.ts` regla 3** (instanciación): recorre `src/` fuera de `composition/`,
  `infrastructure/` y `interface-adapters/gateways/`; extrae `new (Identifier)(`; permite
  builtins (`Date`, `Map`, `Set`, `WeakMap`, `Error` y subclases nativas, `URL`, `RegExp`,
  `Promise`, `Intl.*`) y nombres declarados como `class` en `domain/` o `application/`.
  Fixture: un controller con `new MemoryDecisionLedger()`.
- **`verify-finding`**: entrada = JSON de hallazgos según
  `contracts/audit-finding.schema.json`; salida = mismo JSON con `verified: true|false` y
  `reason`. Un hallazgo no verificado no entra al reporte; la skill lo dice.
- **Parche del runner de Stryker** (R-05): `patches/@stryker-mutator+vitest-runner+10.0.0.patch`
  cambia `nameParts.join(' ')` por `join(' > ')` en `dist/src/stryker-setup.js` y
  `dist/src/test-helpers.js` (el fix de stryker-js#6214, verificado: mismo resultado que
  Vitest 4.1). `patch-package` corre en `postinstall` junto a lefthook y falla la
  instalación si el parche no aplica, así que una subida de versión del runner obliga a
  revisarlo. Encabezado del parche: issue, PR y condición de retiro. `mutation-diff.mjs`
  además falla si algún mutante `Survived` tiene `testsCompleted: 0` con `coveredBy` no
  vacío (runner roto ≠ prueba débil).
- **Skill en español, scripts en inglés**: `SKILL.md` y `references/` son instrucciones para
  agentes (misma categoría que `CLAUDE.md`, en español por decisión del usuario); los scripts
  de la skill son código (inglés, `check:language` los examina porque viven bajo
  `.claude/skills/*/scripts/` → se agregan al alcance).

## Complexity Tracking

| Elemento                                                                   | Por qué                                                                                                                     | Alternativa rechazada                                                                                                                                              |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dos copias de TypeScript (`@typescript/native` 7 + `typescript` 6.0 alias) | TS 7 no publica API programática hasta 7.1; typescript-eslint, openapi-typescript y dependency-cruiser la importan          | quedarse en 5.9.3: el usuario lo descartó (dos mayores atrás); `typescript@7` solo: rompe lint con tipos, tipos del contrato y reglas de anillos                   |
| Parche local al runner de Stryker (`patch-package`)                        | con Vitest 5 el runner reporta 100 % de sobrevivientes (stryker-js#6210); el fix upstream (2 líneas) está en PR sin mergear | degradar Vitest a 4.1: deuda desde el día uno y bloquea Vitest 5 para todo el repo por un bug ajeno; esperar el fix con la mutación informativa: contradice FR-030 |
| Cinco scripts nuevos en vez de llamar CLIs en `package.json`               | cada uno decide bloqueante/informativo por alcance, nombra el gate que falla y emite JSON para la skill                     | scripts npm encadenados con `&&`: no distinguen informativo de bloqueante ni sirven a `run-gates`                                                                  |
| `types` de knip informativo, no bloqueante                                 | el contrato público de un módulo (`index.ts`) exporta tipos para consumidores futuros sin costo                             | bloquear: obligaría a quitar tipos de la API pública de módulos recién creados en la 004                                                                           |

## Re-evaluación del Constitution Check (post-Phase 1)

El contrato sólo cambia de idioma (compatible, verificado por `contract:diff`); `src/` no
cambia de comportamiento ni de dirección de dependencias; ningún sustantivo nuevo; ninguna
llamada a modelo en runtime (la skill corre en el agente, fuera del servidor). **PASA.**
