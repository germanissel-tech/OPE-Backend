# Quickstart — Feature 012: plano de decisión II

Guía de validación: cómo comprobar que el plano selecciona, valida y decide comercialmente de
punta a punta. Detalles en [spec.md](spec.md), [data-model.md](data-model.md) y
[contracts/](contracts/).

## Prerrequisitos

- `npm ci` (sin dependencias nuevas), `npm run contract:bundle`.
- Documentos del MVP en `../` (01 §4.4–§4.5, 03 §4.5, §4.8).

## Escenarios automáticos (`npm test`)

| Escenario                                                                                                                | Prueba                                                                                                       | Esperado                                                  |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Catálogo de candidatos: ids únicos, orden por escalera, una barrera por candidato                                        | `tests/unit/domain/selection/candidates.test.ts`                                                             | invariantes del vocabulario                               |
| Quality gate por tabla: cada claim aceptado y rechazado con su motivo; determinismo (SC-002)                             | `tests/unit/domain/selection/quality-gate.test.ts`                                                           | tabla 100 %; 1 000 evaluaciones iguales                   |
| `CommercialPolicy.of` rechaza ≥ 8 casos inválidos nombrando el campo (SC-003)                                            | `tests/unit/domain/commercial/commercial-policy.test.ts`                                                     | `code` + `details`                                        |
| `CommercialPolicy.verdict` por tabla: historias 2 y 3, orden de bloqueos, D-B                                            | `tests/unit/domain/commercial/verdict.test.ts`                                                               | decisión, motivo, `chosen`/`blocked` exactos              |
| Política comercial por defecto con los valores de la spec                                                                | `tests/unit/domain/commercial/default-policy.test.ts`                                                        | `commercial-default-1`                                    |
| `DecisionPolicy.barrierVerdict` (lo que queda de la 011) y `DEFAULT_DECISION_POLICY` sin lo comercial                    | `tests/unit/domain/decision/*.test.ts` (adaptadas)                                                           | mismos resultados de barrera                              |
| `VisitorState` y `memoryVisitorStateStore` (ventana, aislamiento)                                                        | `tests/unit/domain/decision/visitor-state.test.ts`, `tests/unit/gateways/memory-visitor-state-store.test.ts` | poda por 24 h; sin cruce                                  |
| `DecisionService`: orden de las cinco autoridades, `selection` en el ledger, CONTROL igual                               | `tests/unit/application/decision/decision.service.test.ts`                                                   | `candidates[]`, `chosen`, `commercialVerdict`, versiones  |
| Réplicas: motivos NO_OP, `Incentive` vs contrato                                                                         | `tests/unit/no-op-reasons.test.ts`, `tests/unit/contract-*`                                                  | iguales                                                   |
| Integración: gate (perfil sin política de devoluciones), incentivo con margen, bloqueos, fatiga entre sesiones, cooldown | `tests/integration/commercial-policy.test.ts`                                                                | motivo exacto; `intervention.incentive` sólo con `price`  |
| Integración de la 011 (SC-004)                                                                                           | `tests/integration/decision-plane.test.ts`, `decision-evidence.test.ts`                                      | mismos `outcome`/`reason`; `messageVersionId` con escalón |
| Aislamiento: política comercial y estado por visitante de A vs B                                                         | `tests/integration/isolation.test.ts`                                                                        | sin cruce                                                 |
| Configuración: `commercialPolicy` y `evidenceProfile` inválidos                                                          | `tests/unit/composition/config.test.ts`                                                                      | `ConfigError` con el campo                                |
| Latencia con las cinco autoridades (SC-005)                                                                              | `tests/integration/ingest-latency.test.ts`                                                                   | p95 ≤ 50 ms                                               |
| Arquitectura: `selection`, `commercial` en el mapa; `selection` no depende de `commercial`                               | `npm run arch`                                                                                               | 0 violaciones                                             |

## Escenario manual (`npm run dev` + curl/Insomnia)

1. `PUT /v1/catalog` con `SKU-1` (variante M disponible).
2. `POST /v1/events` con `block_dwelled price 6 s` + `cta_approached` → barrera `price` →
   `INTERVENE` con `messageVersionId: msg_price_price_incentive_v0` e `incentive { percent: 5 }`
   (el merchant de desarrollo lleva `marginPercent: 40`).
3. Quitar `marginPercent` de `config/dev-merchants.json` y repetir → `msg_price_price_evidence_v0`
   sin incentivo (o `commercial-policy-blocked` si el stock/precio es viejo).
4. Con `evidenceProfile.returnsPolicy: false`, agregar al carrito y leer políticas →
   `msg_returns_policies_information_v0` (el reaseguro fue `UNACCEPTABLE: no-returns-policy`).
5. Cuatro sesiones distintas del mismo visitante con señales fuertes → la cuarta es
   `NO_OP visitor-fatigue`.

## Gates antes del PR

`npm run format:check && npm run quality && npm run typecheck && npm test && npm run
contract:check && npm run test:mutation && npm run test:contract && npm run release-check`.
