# Quickstart — Feature 011: plano de decisión I

Guía de validación: cómo comprobar que el plano infiere, verifica evidencia y decide de punta a
punta. Los detalles están en [spec.md](spec.md), [data-model.md](data-model.md) y
[contracts/](contracts/).

## Prerrequisitos

- `npm ci` (sin dependencias nuevas), `npm run contract:bundle`.
- Documentos del MVP en `../` (01 §4.1–§4.5, 03 §4.2).

## Escenarios automáticos (`npm test`)

| Escenario                                                                                | Prueba                                                                 | Esperado                                                                      |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Álgebra de condiciones (`all`/`any`/`not`, identidades, predicados) por tabla            | `tests/unit/domain/barrier/condition.test.ts`                          | tabla 100 %                                                                   |
| `Signals.of` / `merge` / `sequence` (monoide; subtipo cuenta doble)                      | `tests/unit/domain/barrier/signals.test.ts`                            | asociatividad, identidad, secuencias                                          |
| `BarrierRules.of` rechaza ≥ 8 políticas inválidas nombrando el campo (SC-003)            | `tests/unit/domain/barrier/barrier-rules.test.ts`                      | un `code` por caso con `details.path`/`index`                                 |
| `BarrierRules.infer` puro y determinista (1 000 evaluaciones, SC-002)                    | `tests/unit/domain/barrier/barrier-rules.test.ts`                      | mismo veredicto                                                               |
| `DecisionPolicy.of` (versión, umbral, prioridad, presupuesto, evidencia)                 | `tests/unit/domain/decision/decision-policy.test.ts`                   | errores del catálogo                                                          |
| `DecisionPolicy.verdict` — tabla de las historias 1 y 2 (SC-001)                         | `tests/unit/domain/decision/verdict.test.ts`                           | decisión y motivo exactos por fila                                            |
| `DEFAULT_DECISION_POLICY` válida y con los valores propuestos al stakeholder             | `tests/unit/domain/decision/default-policy.test.ts`                    | `default-1`, 0,6 / 0,4 / 0,2 / 5 s / `returns → fit → price`                  |
| `DecisionService`: orden de autoridades, estado de sesión, ledger caído (ADR-021)        | `tests/unit/application/decision/decision.service.test.ts`             | `ledger-unavailable` sin contar intervención; CONTROL registra la inferencia  |
| Réplicas: motivos NO_OP, anclajes (kernel), barreras, vocabulario de eventos vs contrato | `tests/unit/{no-op-reasons,anchors,barriers,event-vocabulary}.test.ts` | iguales al contrato                                                           |
| Integración: ingesta → `INTERVENE` (`size_selector`, `fit`) → `confirmExposure 201`      | `tests/integration/decision-plane.test.ts`                             | 202 con `intervention`, luego 201, repetido 200; DTO sin barrera ni confianza |
| Integración: `barrier-unclear`, `high-intent`, `session-budget-exhausted`, abandono      | `tests/integration/decision-plane.test.ts`                             | motivo exacto                                                                 |
| Integración: `evidence-missing` / `evidence-stale` / `variant-unavailable`               | `tests/integration/decision-evidence.test.ts`                          | según catálogo cargado con `putCatalog` y reloj avanzado                      |
| Aislamiento: política de A vs B; `sessionId` igual en A y B (SC-005)                     | `tests/integration/isolation.test.ts`                                  | decisiones distintas; presupuesto de A no afecta a B                          |
| Configuración: `decisionPolicy` inválida impide el arranque                              | `tests/unit/composition/config.test.ts`                                | `ConfigError` con `merchants[i].decisionPolicy.rules[j]…`                     |
| Latencia de ingesta con inferencia activa (SC-004)                                       | `tests/integration/ingest-latency.test.ts`                             | p95 ≤ 50 ms (umbral sin cambios)                                              |
| Arquitectura: `barrier`, `decision` en el mapa; sin ciclo `ingestion ⇄ decision`         | `npm run arch`                                                         | 0 violaciones                                                                 |

## Escenario manual (`npm run dev` + Insomnia)

1. `npm run contract:insomnia` e importar `docs/api/insomnia.json`.
2. `PUT /v1/catalog` con el ejemplo (catálogo fresco).
3. `POST /v1/events` con dos `size_selector_interacted` y un `block_dwelled { block:
"size_guide", dwellMs: 6000 }` de la misma sesión, en ficha del producto y variante del catálogo →
   `decision.outcome = INTERVENE`, `intervention.anchor = size_selector`,
   `messageVersionId = msg_fit_size_selector_v0` (si el visitante cae en TREATMENT; con
   `treatmentPercent: 100` en `config/dev-merchants.json` siempre).
4. `POST /v1/exposures` con ese `decisionId` → `201 recorded`.
5. Repetir el paso 3 en la misma sesión → `NO_OP session-budget-exhausted`.

## Gates antes del PR

`npm run format:check && npm run quality && npm run typecheck && npm test && npm run
contract:check && npm run test:mutation && npm run test:contract && npm run release-check`.
`check:markers`: los dos PROPUESTO de ADR-024 cerrados; uno nuevo (holdout) en ADR-026.

## Estado al cierre (histórico, 2026-09-18)

| Comando                                | Resultado                                                                                                                                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test` al inicio                   | 80 archivos, 557 pruebas                                                                                                                                                                                                                                                                                            |
| `npm test` al cierre                   | 95 archivos, 735 pruebas                                                                                                                                                                                                                                                                                            |
| `npm run contract:check`               | verde; mapa `4 built, 19 planned` (sin operaciones nuevas); diff compatible                                                                                                                                                                                                                                         |
| `npm run quality`                      | 5 gates en verde; `Lint exceptions: 0`                                                                                                                                                                                                                                                                              |
| `npm run test:mutation`                | every mutant died (con los archivos nuevos en el índice: el diff contra `origin/main` no ve archivos sin seguimiento)                                                                                                                                                                                               |
| `npm run test:contract` (Schemathesis) | 1875 casos, verde                                                                                                                                                                                                                                                                                                   |
| `ingest-latency` con el plano activo   | p50 ≈ 0,5 ms, p95 ≈ 0,8 ms (inject, perfil local)                                                                                                                                                                                                                                                                   |
| `check:markers`                        | los dos PROPUESTO de ADR-024 cerrados; PROPUESTO del holdout en ADR-026                                                                                                                                                                                                                                             |
| Cambios respecto del plan              | `DecisionRecorder.record` devuelve la decisión (degradada a `ledger-unavailable` adentro) y `unrecorded` para la asignación caída: el orquestador no maneja `Result` del ledger; el peso de una regla sale de `strength` con `weights` de la política (override opcional); `variant-unavailable` como motivo propio |
