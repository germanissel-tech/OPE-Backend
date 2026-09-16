# Quickstart — Feature 005: validar gates, idioma y auditoría

## 1. Todo junto

```bash
npm run contract:check && npm run quality && npm test && npm run test:mutation
```

Esperado: todo en 0; `lint` termina con `Lint exceptions: 0`; `check:language` con
`Language exceptions: 0`; `test:mutation` sin sobrevivientes en las líneas del diff (o
`no production lines changed` si la rama no toca `src/`).

## 1b. Compilador vigente (US8)

```bash
npx tsc --version                                   # Version 7.x
node -e 'console.log(require("typescript").version)' # 6.0.x (API para las herramientas)
npm run build && npm run typecheck && npm run lint && npm run contract:types:check && npm run arch
npm outdated                                        # vacío, o sólo entradas con nota en ADR-017
```

## 2. Idioma (US1)

Automático: `npx vitest run tests/governance/language.test.ts`. Manual, en
`src/domain/system/health.ts`:

```ts
// Estado del servicio: sólo para el health check.
```

```bash
npm run check:language   # falla: src/domain/system/health.ts:N con el fragmento
# con `// lang:es -- example kept in Spanish for the merchant` en la línea anterior → pasa, cuenta 1
# sin ` -- motivo` → falla
git checkout src/domain/system/health.ts
```

Contrato: `npm run contract:diff` sin cambios rompientes tras la traducción (SC-007);
`npm run contract:types:check` sin drift.

## 3. Forma del código (US2)

`npx vitest run tests/lint` cubre un fixture por regla. Manual, en cualquier archivo de `src/`:

```ts
function deep(a: number, b: number, c: number, d: number, e: number) {
  // → max-params
  if (a) {
    if (b) {
      if (c) {
        if (d) {
          return e;
        }
      }
    }
  } // → max-depth
  return 0;
}
const ttl = 24 * 60 * 60 * 1000; // → no-magic-numbers (src)
try {
  risky();
} catch (e) {} // → sonarjs/no-ignored-exceptions
```

```bash
npm run lint   # falla nombrando archivo, línea, regla y valor medido
```

## 4. Duplicación y código muerto (US3)

```bash
npx vitest run tests/governance/duplication.test.ts tests/governance/dead-code.test.ts
# manual: copiar el cuerpo de una función de 6+ líneas de un archivo de src/ a otro
npm run check:duplication   # falla nombrando ambos lugares
# manual: agregar `export const unused = 1;` en src/domain/system/health.ts
npm run check:dead-code     # falla: unused export
```

`tests/` con el mismo duplicado: `check:duplication` lo lista y sale 0.

## 5. Mutación sobre el diff (US4)

```bash
npx vitest run tests/governance/mutation-diff.test.ts   # rangos a partir de diffs sintéticos
# manual: en una rama, agregar a src/domain/system/health.ts
#   export function isHealthy(s: string): boolean { return s === "ok"; }
# y una prueba que sólo hace expect(isHealthy("ok")).toBeDefined()
npm run test:mutation       # falla: mutante sobreviviente en health.ts:N (=== → !==)
# corregir la prueba a toBe(true) / toBe(false) → pasa
npm run test:mutation -- --all   # sweep completo, informativo, reporte en reports/mutation/
```

## 6. Forma de los anillos (US5)

```bash
npx vitest run tests/architecture   # fixtures: archivo de 301 líneas en domain/, controller sin operationId, new MemoryDecisionLedger() en un controller
```

## 7. Un comando (US6)

```bash
npm run quality             # lint → arch → check:duplication → check:dead-code → check:language
# con cualquier violación de 2–4 o 6: falla y la primera línea de salida nombra el gate
```

CI: el workflow corre `quality` y `test:mutation`; el job `mutation-full` corre por
`schedule` y `workflow_dispatch` y sube `reports/mutation/`.

## 8. Auditoría (US7)

```bash
npx vitest run tests/audit   # run-gates reporta los 3 evals; verify-finding acepta el esperado y rechaza línea/fuente inexistentes
node .claude/skills/auditing-architecture/scripts/run-gates.mjs --dir src/domain/ingestion
node .claude/skills/auditing-architecture/scripts/verify-finding.mjs findings.json
```

En Claude Code: "auditá el módulo ingestion" / "auditá el diff contra main" → la skill se
activa, corre los gates, propone, refuta, verifica y emite el reporte con estado
`approved` / `changes-required` / `rejected`. Evaluación manual (SC-005): correr la skill
sobre cada `evals/<nombre>/fixture` tres veces; las tres deben producir el hallazgo de
`expected.json` confirmado y verificado.

## Estado al cierre (histórico, 2026-09-16)

Resultado de correr este quickstart sobre `005-auditoria-calidad` en el cierre de la
implementación. Es una foto fechada; el estado vivo lo dan los comandos.

| Sección                | Comando                                               | Resultado                                                                           |
| ---------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1 Todo junto           | `contract:check`, `quality`, `test`, `test:mutation`  | verde; `Lint exceptions: 0`; `Language exceptions: 0`; mutación 100 % sobre el diff |
| 1b Compilador          | `tsc --version` / `require("typescript").version`     | 7.0.2 / 6.0.3; `npm outdated` vacío                                                 |
| 2 Idioma               | `tests/governance/language.test.ts`, `check:language` | verde; contrato traducido compatible (`contract:diff` sin rompientes)               |
| 3 Forma del código     | `tests/lint`                                          | verde (fixture por regla; `as-src` y `as-test` por alcance)                         |
| 4 Duplicación y muerto | `duplication.test.ts`, `dead-code.test.ts`            | verde; `src/` sin clones; sin archivos, exports ni dependencias sin uso             |
| 5 Mutación             | `mutation-diff.test.ts`, `patches.test.ts`, gate real | verde; diff de la rama: 51 mutantes muertos, 0 sobrevivientes, 2 min 24 s           |
| 6 Forma de los anillos | `tests/architecture`                                  | verde (10 pruebas)                                                                  |
| 7 Un comando           | `quality`, `.github/workflows/ci.yml`                 | 5 gates verdes; CI con `quality`, `test:mutation` y job `mutation-full` programado  |
| 8 Auditoría            | `tests/audit`, `evals/RESULTS.md`                     | verde (8 pruebas); 9/9 corridas manuales con MATCH                                  |
| Cierre                 | `release-check`, `build`, `test:contract`             | OK; Schemathesis 1679 casos, 0 fallas                                               |
