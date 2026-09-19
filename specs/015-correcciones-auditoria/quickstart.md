# Quickstart — verificar la 015

## Prerrequisitos

Node 22, `npm ci`, `uvx` (Schemathesis). Rama `015-correcciones-auditoria` desde `main` con el
PR #23 (auditoría 014) mergeado.

## Por historia

| Historia | Comando / lectura                                                                                                                 | Esperado                                                                                            |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| US1      | `head -20 .specify/memory/constitution.md`; `grep -n "incentivo" .specify/memory/constitution.md`                                 | v1.3.0; VII lista el incentivo aplicado                                                             |
| US1      | `npm run check:api-map`; `grep -n '"02[01]"' contracts/api-map.yaml`                                                              | verde; roadmap renumerado con "Platform port and adapters"                                          |
| US1      | `grep -rn "modo real\|mock\|ADR-006" CLAUDE.md docs/adr/013-*.md src/`                                                            | nada vigente (ADR-005/018 pueden nombrarse como reemplazados)                                       |
| US1      | `npx vitest run tests/unit/domain/commercial tests/integration/commercial-policy.test.ts`                                         | verde con la política en tasas y el DTO en enteros; caso "cada entero 1..100 sobrevive el viaje"    |
| US2      | `npx vitest run tests/unit/domain/merchant tests/unit/domain/experiment tests/unit/composition/config.test.ts`                    | `[invariant:invalid-ingest-keys]`, `[invariant:multiple-active-experiments]` …; config sólo traduce |
| US2      | `npx vitest run tests/integration/cors.test.ts`                                                                                   | el preflight no anuncia `x-ope-platform-key`                                                        |
| US2      | `npx vitest run tests/integration/ingest-events.test.ts tests/integration/catalog.test.ts tests/integration/catalog-size.test.ts` | 1 MiB a la ingesta ⇒ 413; snapshot del piloto ⇒ 201; almacén caído ⇒ 503 con `Retry-After`          |
| US2      | `npm run contract:check`                                                                                                          | `contract:diff` sin cambios incompatibles (503 nueva compatible)                                    |
| US3      | `npm run test:mutation -- --all` y `npx vitest run tests/governance/mutation-diff.test.ts`                                        | ningún `Ignored` fuera de las líneas de una excepción (SC-006)                                      |
| US3      | `npm run lint`                                                                                                                    | `Lint exceptions: 0` con `detectObjects: true`                                                      |
| US3      | `npm run test:contract`                                                                                                           | sin "401 Unauthorized (3 operations)"; las siete operaciones ejercitadas                            |
| US3      | `time npm test` / `npm run test:tools`                                                                                            | `npm test` ≥ 40 % más rápido que 147 s; `tools` corre las pruebas de herramientas; CI corre ambas   |
| US4      | `npx vitest run tests/governance/test-headers.test.ts`                                                                            | toda cabecera con `FR-`/`SC-` nombra `Feature NNN`                                                  |
| US4      | `npm run quality && npm run typecheck && npm test`                                                                                | verde                                                                                               |

## Cierre (SC-001, SC-002)

1. `node .claude/skills/auditing-architecture/scripts/verify-finding.mjs docs/auditoria/trabajo/hallazgos/fase-N.json`
   para N = 1..4: todos `verified: true`, con `closure` en los 52 en alcance.
2. Re-corrida: `run-gates.mjs --module <m> --json` sobre los 15 alcances (`--dir` para los tres
   sin módulo) → ningún gate rojo; la rúbrica de `specs/014-auditoria-integral/contracts/rubrica.md`
   sobre `git diff --name-only main -- src tests` → ningún F-NNN `resolved` reproducido.
3. Estado global recalculado (regla fija): `changes-required` o `approved`, o `rejected` sólo
   por F-043/F-045/F-046.
4. Informe §8 escrito; `npm run check:markers` 0 abiertos / 0 placeholders;
   `npx prettier --check .`.

## Cambios respecto del plan

- 2026-09-19 US2 (T034): `CatalogStore.replace` devuelve `Result<void, LedgerUnavailable>` y `LedgerUnavailable` vive en el módulo `ledger`, así que `catalog` pasa a depender de `ledger` en `CONTEXT_MAP` (`catalog: [shared-kernel, ledger]`), como ya lo hacen `experiment` y `outcomes`; el plan decía "ningún cambio en CONTEXT_MAP". Alternativa descartada: mover `LedgerUnavailable` al shared-kernel (toca ADR-023).
- 2026-09-19 T001: línea base en la rama, `npm test` 1004/1004 en **151 s** (referencia SC-005: objetivo ≤ 91 s).
