# Research — Feature 005: auditoría de calidad y arquitectura

**Fecha**: 2026-09-16 · **Estado**: completo. Las decisiones transversales están en ADR-015
(idioma del código y del contrato), ADR-016 (gates de calidad: forma, duplicación, código
muerto y mutación) y ADR-017 (TypeScript 7 con API 6.0), en estado `propuesta` hasta que la
implementación cierre.

Todas las cifras de esta página son del sondeo de esta fecha sobre `main` en `316f20b`;
son históricas, no estado vivo.

## R-00 Estado del arte consultado

- **Gates por dimensión, apilados**: ninguna herramienta cubre tipado, forma, fronteras,
  duplicación, código muerto y calidad de pruebas a la vez; se apilan una por dimensión y
  todas bloquean en CI ("un check que se puede saltar no es un check"). Las tres patologías
  del código generado por agentes que el tipado y las fronteras no ven: estructura
  acumulada (complejidad), código que se agrega y nunca se quita (muerto) y segunda versión
  en lugar de reutilizar (duplicado).
- **Fitness functions**: las reglas de arquitectura son pruebas que corren en cada commit
  (Building Evolutionary Architectures). El repo ya lo hace para dirección de dependencias
  (`tests/architecture/`); esta feature lo extiende a forma.
- **Skills de auditoría**: la guía de autoría de skills del proveedor pide `SKILL.md` corto
  (< 500 líneas) con workflow en checklist, referencias a un solo nivel de profundidad,
  scripts para lo determinista (sólo su salida entra al contexto), feedback loops
  (validar → corregir → repetir), salidas intermedias verificables por script, y
  evaluaciones escritas antes que la documentación. Anti-patrones: puntuaciones inventadas,
  criterios genéricos sin fuente, hallazgos sin ubicación.

## R-01 Idioma → verificación por lista curada + migración por directorio

- **Decisión (DECIDIDO → ADR-015)**: `scripts/check-language.mjs`, mismo estilo que los otros
  `check:*` (`governance-lib.mjs`, `report()`), entra en `contract:check` y en `quality`.
  Detección por línea, dos detectores: caracteres `[áéíóúñÁÉÍÓÚÑ¿¡]` y palabras funcionales
  del español con límite de palabra e insensibles a mayúsculas, leídas de
  `scripts/language-denylist.json` (lista única y ampliable, como `pii-denylist.json`).
  Sólo se examinan **comentarios y strings** (no identificadores): para TS/JS se extrae con
  el tokenizador de TypeScript (`ts.createScanner` distingue comentarios, strings y
  templates de identificadores; ya es dependencia); para YAML/JSON se examina toda la línea
  (no hay identificadores en el sentido del código).
- **Alcance** (FR-001): `src/`, `tests/`, `scripts/`, `contracts/`, `.github/` y los archivos
  de configuración de la raíz (`eslint.config.mjs`, `.dependency-cruiser.cjs`,
  `vitest.config.ts`, `lefthook.yml`, `redocly.yaml`, `package.json`). Exclusiones: las de
  `.prettierignore` (lista única, FR-004: generados, fixtures) más `scripts/language-denylist.json`.
  Fuera de alcance: `docs/`, `specs/`, `.specify/`, `.claude/`, `CLAUDE.md`, `README.md`.
- **Excepción en línea** (FR-003): `// lang:es -- motivo` (o `# lang:es -- motivo` en YAML) en
  la misma línea o en la anterior; sin ` -- motivo` falla. Se cuentan al final:
  `Language exceptions: N`. `check-lint-exceptions.mjs` no las cuenta: son de otra regla.
- **Sondeo** (script de prueba, 185 archivos): **183 archivos y ~1.090 líneas** con español:
  `src` 225, `tests` 343, `scripts` 153, `contracts` 317, configs raíz ~50, `.github` 4. El
  detector por palabras atrapa 471 líneas que el de acentos no ve (43 %): los dos son
  necesarios. Falso positivo encontrado: la palabra `o` en `"-o"` (flag de CLI) → las
  palabras de una letra (`y`, `o`, `a`) quedan fuera de la lista; una frase en español
  siempre trae otra palabra funcional.
- **Migración** (FR-005), por directorio y en commits separados para que cada diff sea
  revisable y el contrato se verifique aparte: (1) `contracts/` (descripciones, `summary`,
  `problem-types.yaml`, `no-op-reasons.yaml`, mensajes de `.spectral.yaml` y de
  `rules/functions/`), regenerar tipos, actualizar la réplica en `problem-details.ts` y las
  pruebas que afirman sobre `title`/`detail`; (2) `src/`; (3) `tests/`; (4) `scripts/` y
  configs raíz (`Excepciones de lint: N` → `Lint exceptions: N`, con la guía actualizada);
  (5) `.github/`. Traducir descripciones es compatible: `contract:diff` (oasdiff) las clasifica
  como cambio informativo, no rompiente (verificado en la 001, R-04). `check:glossary`
  resuelve sustantivos por el campo `en` de cada nota, no por descripciones: no se ve afectado.
- **Alternativas rechazadas**: detección estadística de idioma (`franc`, `cld3`): opaca, con
  umbrales, falsos negativos en líneas cortas; la lista curada es auditable y su corrección es
  editar un JSON. Regla de ESLint custom: no cubre YAML ni `.github/`.

## R-02 Forma del código → `eslint-plugin-sonarjs` 4 + reglas core

- **Decisión (DECIDIDO → ADR-016)**: `eslint-plugin-sonarjs@^4.2` (peer `eslint ^10`:
  compatible) en `eslint.config.mjs`, sólo las reglas que la spec nombra más una:

  | Regla                                 | Valor                                            | Justificación                                                                                                    |
  | ------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
  | `sonarjs/cognitive-complexity`        | 15                                               | umbral del paper original de Sonar (Campbell 2018); por encima, la función ya no se entiende de una lectura      |
  | `max-depth`                           | 3                                                | a partir del cuarto nivel el ojo pierde la condición que abrió el bloque; extraer función                        |
  | `max-params`                          | 4                                                | más de cuatro argumentos posicionales se confunden; la alternativa es un objeto de opciones con nombre           |
  | `max-lines-per-function`              | 60 (sin blancos ni comentarios)                  | una pantalla; `src/` y `scripts/`. **Apagada en `tests/`**: los callbacks de `describe` agrupan casos, no lógica |
  | `sonarjs/no-identical-functions`      | error                                            | duplicación semántica (FR-011)                                                                                   |
  | `sonarjs/no-all-duplicated-branches`  | error                                            | idem                                                                                                             |
  | `sonarjs/no-identical-conditions`     | error                                            | idem                                                                                                             |
  | `sonarjs/no-collapsible-if`           | error                                            | idem                                                                                                             |
  | `sonarjs/no-redundant-boolean`        | error                                            | idem                                                                                                             |
  | `sonarjs/no-ignored-exceptions`       | error                                            | **agregada**: `catch` vacío o que ignora el error; es el tercer escenario de evaluación de la skill (FR-066)     |
  | `@typescript-eslint/no-magic-numbers` | `src/` sólo; ignore `[0, 1, -1]`, índices, enums | FR-012; las tasas 0–1 y los tiempos en ms son exactamente lo que hay que nombrar                                 |

- **Sondeo** (ESLint 10.10 + sonarjs 4.2.1, 28 s sobre todo el repo): complejidad cognitiva,
  `max-params`, funciones idénticas, ramas duplicadas, condiciones repetidas, `if`
  colapsable, booleanos redundantes y `catch` ignorado: **0 hallazgos**. `max-depth`: 2
  (`scripts/check-glossary.mjs:210,218`). `max-lines-per-function`: 5 — `buildServer` en
  `src/infrastructure/http/build-server.ts` (**189 líneas**: se parte en registro de
  seguridad, de handlers y de errores), `main` de `contract-diff.mjs` (70) y de
  `test-contract.mjs` (82), y dos `describe` de tests (por eso la regla se apaga en
  `tests/`). `no-magic-numbers`: **14 en `src/`**, todos aritmética de unidades dentro de
  constantes con nombre (`24 * 60 * 60 * 1000` en `batch.ts` y `memory-event-dedup.ts`),
  `3000` (puerto por defecto), `2` (máximo de claves de ingesta) y `400` (umbral de Problem
  Details). Se resuelven con constantes en `domain/shared-kernel` (`MS_PER_SECOND`,
  `hours()`/`minutes()`) y en `composition/config.ts` (`DEFAULT_PORT`, `MAX_INGEST_KEYS`).
  Ninguno requiere excepción.
- **Considerada y rechazada**: `sonarjs/no-duplicate-string` (16 hallazgos, 15 en tests:
  rutas y cabeceras repetidas por legibilidad; en `src/` 0). La duplicación de literales la
  cubre jscpd cuando es estructural.

## R-03 Duplicación estructural → jscpd 5

- **Decisión (DECIDIDO → ADR-016)**: `jscpd@^5.2`, invocado desde `scripts/check-duplication.mjs`
  (API programática, dos pasadas): (a) `src/` sin `generated/`, `minTokens: 50`, `minLines: 5`,
  **bloqueante** con 0 clones; (b) `tests/` y `scripts/` sin fixtures, mismos umbrales,
  **informativa** (lista los clones, no falla). 50 tokens ≈ 5 líneas de TypeScript con
  llaves: por debajo son coincidencias de sintaxis; por encima, conocimiento repetido.
- **Sondeo** (1,5 s): `src/` **1 clon real**: la traducción `invariant → 422` repetida en
  `controllers/ingestion/ingest-events.ts:69-75` y `controllers/ledger/confirm-exposure.ts:20-26`.
  Se extrae a `interface-adapters/http/problem-details.ts` como `invariantResponse(req, result)`.
  `tests/` + `scripts/`: 10 clones (cabeceras de imports y arranque de app de prueba en
  integración, `contract-docs.mjs` vs `contract-bundle.mjs`): quedan informativos; los de
  integración son candidatos a `tests/helpers/test-app.ts` en una tarea de bajo riesgo.

## R-04 Código muerto → knip 6

- **Decisión (DECIDIDO → ADR-016)**: `knip@^6.36`, `knip.json` con entradas explícitas
  (`src/main.ts`, `src/interface-adapters/http/client.ts`, `scripts/*.mjs`,
  `contracts/rules/functions/*.js`, `tests/**/*.test.ts`, `tests/**/*.test-d.ts`,
  `tests/contract-rules/gen-fixtures.mjs`, configs raíz), `ignore` de fixtures y generados,
  `ignoreDependencies` con motivo en comentario del script que lo invoca:
  `@redocly/cli` y `redoc` (se invocan por CLI desde `runCli("redocly")` y se leen de
  `node_modules` en `contract-docs.mjs`), `@stoplight/spectral-ruleset-bundler` (idem);
  `ignoreBinaries: ["uvx"]` (Schemathesis). Bloqueante: `files`, `exports`, `dependencies`,
  `unlisted`. **Informativo**: `types` y `nsTypes` — los tipos que un módulo exporta en su
  `index.ts` son su contrato público y no tienen costo en runtime; se listan aparte para
  revisarlos, no bloquean.
- **Sondeo** (9,8 s): 1 dependencia **sin declarar** (`@stoplight/spectral-parsers`, importada
  directamente en `tests/contract-rules/rules.test.ts` como transitiva: se agrega a
  `devDependencies`); **20 exports sin uso** (`MOCK_MERCHANT`, `parseMerchants`,
  `EVENT_TYPES`, `EXPOSED`, `ID_PATTERN`, `isWellFormedId`, `CORS_ALLOWED_HEADERS`,
  `requestSerializers`, `REDACTED_PATHS`, `toDomainEvent`, `toDecisionDto`,
  `INGEST_KEY_HEADER`, cuatro de `tests/helpers/test-app.ts` y sus reexports en `index.ts`):
  se revisan uno a uno — se quita el `export` si sólo se usa en el archivo, se borra si no se
  usa, se conserva con `/** @public */` sólo si es API del módulo con consumidor previsto en
  una feature ya especificada; **77 tipos exportados sin uso** (informativo). 3 devDeps
  marcadas sin uso son falsos positivos por invocación CLI (arriba).

## R-05 Calidad de las pruebas → Stryker 10 sobre el diff; runner parcheado para Vitest 5

- **Decisión (DECIDIDO → ADR-016)**: `@stryker-mutator/core@^10`,
  `@stryker-mutator/vitest-runner@^10`, `@stryker-mutator/typescript-checker@^10`.
  `stryker.config.json` base: `testRunner: vitest`, `checkers: ["typescript"]`,
  `coverageAnalysis: perTest`, `ignorePatterns` para `generated/`, `composition/`,
  `main.ts`, `*.d.ts` y archivos sólo de tipos (FR-032), `reporters: ["clear-text", "html"]`.
  - **Bloqueante sobre el diff** (FR-030): `scripts/mutation-diff.mjs` lee
    `git diff <base>...HEAD --unified=0 -- src` (base = `origin/main`, `CONTRACT_BASE_REF`
    reutilizado), convierte los hunks en rangos `src/archivo.ts:inicio-fin` (sintaxis nativa
    de `mutate`), y corre Stryker con `thresholds.break: 100`. Sin líneas de producción o sin
    base: imprime el motivo y sale 0 (FR-033). Comando: `npm run test:mutation`.
  - **Informativo completo** (FR-031): job de GitHub Actions con `schedule` semanal y
    `workflow_dispatch`, `npm run test:mutation -- --all`, sube `reports/mutation/` como
    artefacto; `continue-on-error`.
- **Sondeo — hallazgo bloqueante**: con **Vitest 5.0.1** el runner ejecuta 0 pruebas por
  mutante y reporta todo como sobreviviente. Causa (issue stryker-js#6210, abierto): Vitest 5
  compara `testNamePattern` contra `suite > test` y el runner arma el id del test con
  `suite test` (`nameParts.join(' ')` en `dist/src/stryker-setup.js` y
  `dist/src/test-helpers.js`); el filtro nunca matchea. Dos PRs abiertos con el fix
  (#6214, #6220), ninguno mergeado; el proyecto publica con meses de distancia (10.0.0 en
  agosto de 2026).
- **Verificación del fix**: aplicando localmente el cambio de los PRs (`join(' ')` →
  `join(' > ')` en los dos archivos, 2 líneas) sobre `vitest-runner@10.0.0` con
  **Vitest 5.0.1**: `batch.ts` 87,5 % (35 muertos, 3 sobrevivientes reales, 2 sin
  cobertura), 5,6 pruebas por mutante, 59 s para 40 mutantes con `concurrency: 4`. Idéntico
  al resultado con Vitest 4.1.11 (mismos 35/3/2, 55 s). El bug es exactamente eso.
- **Decisión (DECIDIDO → ADR-016): Vitest se queda en 5; el runner se parchea localmente**
  con `patch-package` (`patches/@stryker-mutator+vitest-runner+10.0.0.patch`, aplicado en
  `postinstall`; el parche es la versión compilada del fix de #6214). No se degrada ninguna
  herramienta. El parche lleva en su encabezado el issue y la condición de retiro: cuando
  `vitest-runner` publique el fix, se sube la versión y se borra el archivo de `patches/`;
  `patch-package` falla la instalación si el parche ya no aplica, así que no puede quedar
  olvidado en silencio. Sobre el downgrade a 4.1 (considerado y rechazado por el usuario):
  fijar una herramienta a una versión vieja para acomodar otra es deuda desde el primer día
  y bloquea toda mejora de Vitest 5 al repo entero por un bug de dos líneas ajeno.
- **Guarda adicional en `mutation-diff.mjs`**: un mutante `Survived` con `testsCompleted: 0`
  y `coveredBy` no vacío en el reporte JSON es un runner roto, no una prueba débil (misma
  clase de falla que #6210 y #6213); el script lo detecta y falla con
  `mutation runner executed zero tests for covered mutants` en lugar de reportar
  sobrevivientes falsos. Cubierto por `tests/governance/mutation-diff.test.ts` con un
  reporte sintético.
- **Tiempo esperado** (SC-003): ~1,5 s/mutante; un cambio de 200 líneas de producción genera
  ~150 mutantes → 3–4 min + 20 s de dry run. Dentro de los 10 min.
- **Alternativa rechazada**: gatear por puntaje global (p. ej. ≥ 80 %): no distingue lo que
  el cambio agrega de deuda previa, y un sweep completo tarda demasiado para cada PR.

## R-06 Forma de los anillos → `tests/architecture/shape.test.ts`

- **Decisión (DECIDIDO)**: pruebas de forma con `node:fs` y el bundle del contrato, sin
  herramienta nueva; cada regla con fixture en `tests/architecture/fixtures/` como las de
  dependencia. Reglas (FR-040):
  1. **Tamaño**: ningún archivo de `src/domain/` ni `src/application/` supera 300 líneas
     (hoy el máximo es `domain/ingestion/event.ts`, 99). 300 = cinco pantallas: por encima,
     el módulo tiene más de una responsabilidad o mezcla tipos con reglas.
  2. **Un controller por operación**: para cada `operationId` del bundle existe exactamente
     `src/interface-adapters/http/controllers/<módulo>/<kebab(operationId)>.ts`, y cada
     archivo de `controllers/` corresponde a un `operationId` (hoy 3/3: `getHealth`,
     `ingestEvents`, `confirmExposure`).
  3. **Instanciación sólo en composición**: fuera de `src/composition/`,
     `src/infrastructure/` y `src/interface-adapters/gateways/`, toda expresión `new X(` es de
     un builtin de JavaScript (`Date`, `Map`, `Set`, `Error`, `URL`, `RegExp`…) o de una clase
     declarada en `domain/`/`application/`. Los gateways, adaptadores y el servidor sólo se
     construyen en `composition/` (constitución I: composition root único).
  4. **API pública de módulo**: regla existente de dependency-cruiser (`CONTEXT_MAP`,
     `index.ts`); se verifica que `bad-internal-import.ts` la cubre — sí (fixture presente).
- **Sondeo**: 0 violaciones hoy. `Fastify(...)` en `build-server.ts` es infraestructura
  construyendo su framework: permitido por la regla 3.

## R-07 Un comando → `npm run quality`

- **Decisión (DECIDIDO)**: `quality` = `lint` (ya incluye sonarjs y complejidad) →
  `arch` → `check:duplication` → `check:dead-code` → `check:language`; falla en el primero
  rojo y lo nombra (script `scripts/quality.mjs`, misma forma que `release-check.mjs`).
  `test:mutation` queda separado por su costo. CI: `quality` después de `lint`, y
  `test:mutation` después de `test`. `check:language` además entra en `contract:check`
  (contrato en inglés es gobernanza del contrato).
- Tiempo del sondeo: lint 28 s, jscpd 1,5 s, knip 10 s, idioma < 1 s, arch ~5 s → < 1 min,
  bajo el objetivo de 3 min de SC-003.

## R-08 Skill `auditing-architecture`

- **Decisión (DECIDIDO)**: `.claude/skills/auditing-architecture/` con:
  - `SKILL.md` (< 150 líneas, en español como `CLAUDE.md`: son instrucciones para agentes,
    no código): frontmatter con `description` en tercera persona y disparadores ("auditar",
    "revisar arquitectura", "SOLID", "deuda"); workflow en checklist de 6 pasos: resolver
    alcance → `scripts/run-gates.mjs` → leer criterios → hallazgos propuestos →
    refutación → `scripts/verify-finding.mjs` → reporte. Alcances: `--module <nombre>`,
    `--dir <ruta>`, `--diff` (contra `origin/main`).
  - `references/criterios-diseno.md`: cada principio definido **en términos del repo** con
    fuente: SRP = una autoridad/módulo por carpeta (constitución I, ADR-013); OCP = agregar
    módulo = agregar entrada al `CONTEXT_MAP`, no tocar otros (ADR-013); LSP = un perfil de
    `Ports` reemplaza otro sin cambiar pruebas (`profiles/`); ISP = puertos por caso de uso
    en `application/<módulo>/ports/`, no un repositorio monolítico; DIP = controllers y casos
    de uso reciben puertos, nunca gateways ni infraestructura (reglas `controllers-no-gateways`
    y afines de dependency-cruiser); DRY = conocimiento, no texto: catálogos replicados
    (`problem-types.yaml` ↔ `problem-details.ts`) sólo con prueba de réplica, sustantivos
    sólo con nota (ADR-008); claridad = nombres con intención, `NO_OP` con motivo
    (constitución II), errores explícitos (`no-ignored-exceptions`).
  - `references/formato-hallazgo.md`: el esquema de `contracts/audit-finding.schema.json`
    explicado, la tabla de severidad (Alta: constitución/ADR; Media: guía de agentes; Baja:
    claridad) y la regla del estado global.
  - `references/refutacion.md`: preguntas de la segunda pasada (¿es coincidencia o
    conocimiento? ¿hay ADR que lo justifique? ¿la prueba propuesta fallaría hoy?).
  - `scripts/run-gates.mjs`: corre `quality` (y `test:mutation` si `--diff`) capturando
    salida en JSON `{ gate, status, findings[] }`.
  - `scripts/verify-finding.mjs`: valida cada hallazgo contra el esquema; comprueba que
    `file:line` existe y que `rule.source` resuelve (`ADR-NNN` → archivo en `docs/adr/`,
    `constitution#<sección>` → encabezado, `lint:<regla>` → regla en `eslint.config.mjs`,
    `arch:<regla>` → nombre en `.dependency-cruiser.cjs`). Reutiliza `governance-lib.mjs`.
  - `evals/`: tres escenarios (FR-066) con fixture y hallazgo esperado:
    `controller-instantiates-infra` (atrapado por `arch` + regla 3 de R-06),
    `identical-domain-functions` (`sonarjs/no-identical-functions`),
    `empty-catch` (`sonarjs/no-ignored-exceptions`). Los tres tienen detector determinista:
    la parte cognitiva de la skill se evalúa manualmente sobre ellos (SC-005), y una prueba
    automática (`tests/audit/`) confirma que `run-gates` los reporta y que `verify-finding`
    acepta el hallazgo esperado y rechaza uno con línea o fuente inexistente.
- **Por qué scripts y no sólo prosa**: la guía de autoría del proveedor — lo determinista va
  en scripts (sólo la salida entra al contexto), lo cognitivo en instrucciones cortas con
  criterios de referencia, y toda salida crítica se valida por script antes de emitirse.

## R-09 Orden de implementación y ADRs

1. TypeScript 7 + API 6.0 (R-10) + correcciones de `checkJs` + `npm update` de lo que está
   dentro de rango.
2. Migración a inglés por directorio (R-01), con `check:language` en verde al final.
3. Gates de forma y duplicación (R-02, R-03) + correcciones (partir `buildServer`, helper
   422, constantes con nombre).
4. Código muerto (R-04) + limpieza de exports.
5. Stryker + parche del runner + `mutation-diff` (R-05) + CI.
6. Forma de anillos (R-06) + `quality` (R-07) + guía de agentes.
7. Skill (R-08) + evals + `tests/audit/`.
8. ADR-015, ADR-016 y ADR-017 pasan de `propuesta` a `aceptada`; `CLAUDE.md` (idioma,
   comandos, gates, compilador).

## R-10 Compilador → TypeScript 7 con la API 6.0 side-by-side (DECIDIDO → ADR-017)

- **Estado del registro** (`npm view`, 2026-09-16): `typescript` latest **7.0.2** (julio 2026,
  compilador nativo en Go, binario por plataforma, sin `main`, exports `./unstable/*`); 6.0.3
  es la última versión del compilador en JavaScript; el repo estaba fijado en 5.9.3
  (septiembre 2025). Consumidores de la API: typescript-eslint 8.70 (peer `>=4.8.4 <6.1.0`),
  openapi-typescript 7.13 (peer `^5.x`), dependency-cruiser 18.3 (sin peer, la carga si
  existe), `@stryker-mutator/typescript-checker` (peer `>=3.6`). Vitest, tsx y esbuild no la
  usan.
- **Sondeo con `typescript@7.0.2` solo**: `tsc -p tsconfig.json` compila `src/` en **2 s**;
  `tsconfig.typecheck.json` pasa; `tsconfig.scripts.json` da **5 diagnósticos nuevos**
  (inferencia `string[]` en vez de literales para `EXTERNAL` en `.dependency-cruiser.cjs`
  ×2; TS2309/TS2305/TS2339 por `module.exports = fn; module.exports.x = …` en
  `requiredErrorResponses.js`/`requiredCapabilities.js`). typescript-eslint aborta con
  "does not support TS 7.0" y remite al side-by-side y a su issue #10940 (soporte para
  ≥ 7.1); openapi-typescript, dependency-cruiser ("support for typescript@>=7 will follow
  when its API is published") y 3 pruebas de Vitest que usan `ts.factory` fallan.
- **Sondeo con el side-by-side oficial** (`typescript` = `npm:@typescript/typescript6@^6.0`,
  `@typescript/native` = `npm:typescript@^7.0`): `tsc --version` → 7.0.2;
  `require("typescript").version` → 6.0.3. Build ✔, typecheck ✔, **`eslint .` ✔ en 19 s**,
  `contract:types:check` ✔ (tipos generados idénticos), `arch` ✔ (64 módulos), Vitest
  **224/226**: la única falla real es `tests/typecheck/typecheck.test.ts`, que espera
  `TS2307` para un side-effect import inexistente y TS 7 emite `TS2882` (código nuevo, más
  preciso): se actualiza el fixture. (La otra falla del sondeo era `check:adrs` reclamando
  citas a ADR-015/016 aún no escritos; resuelto creando los ADRs en estado `propuesta`.)
  Los 5 diagnósticos de `checkJs` aparecen con `tsc` 7 y no con 6: se corrigen en el código
  (`/** @type {const} */`, y `isAuthenticated` exportado desde un módulo propio en lugar de
  colgarlo de `module.exports`).
- **Decisión**: `build`, `typecheck` y el hook compilan con 7; las herramientas importan 6.0.
  Alias exactamente como lo documenta Microsoft; retiro cuando typescript-eslint y
  dependency-cruiser admitan la API ≥ 7.1 (ADR-017). Configuración: los tres `tsconfig` ya
  cumplen los defaults nuevos de 7 (`rootDir` explícito, `types` explícito en scripts,
  `moduleResolution: NodeNext`, sin `baseUrl`).
- **Actualizaciones dentro de rango** (FR-072): `openapi-backend` 5.21.0, `cross-env` 10.1.0,
  `tsx` 4.23.13 vía `npm update`. Todo lo demás ya está en su última versión publicada.
- **Alternativas rechazadas**: quedarse en 5.9.3 (dos mayores atrás; el usuario lo descartó);
  subir sólo a 6.0.3 (JS, deprecaciones puente, no es la versión vigente); `typescript@7` sin
  alias (rompe lint con tipos, tipos del contrato y reglas de anillos: tres pilares de la
  gobernanza).
