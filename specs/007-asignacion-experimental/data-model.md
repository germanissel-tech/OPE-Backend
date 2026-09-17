# Data model — Feature 007

En memoria detrás de puertos; los identificadores son tipos marcados (`MerchantId`,
`VisitorId`, …; nuevo `ExperimentId`).

## Experimento (módulo `experiment`)

| Campo              | Tipo                 | Regla                                                                    |
| ------------------ | -------------------- | ------------------------------------------------------------------------ |
| `experimentId`     | `ExperimentId`       | patrón de ids del contrato (`^[A-Za-z0-9_-]{8,64}$`); único por merchant |
| `merchantId`       | `MerchantId`         | dueño                                                                    |
| `treatmentPercent` | entero 0..100        | por defecto 50; 0 y 100 admitidos                                        |
| `seed`             | string no vacío      | parte de la clave del hash; inmutable (cambiarla = experimento nuevo)    |
| `status`           | `active` \| `closed` | como máximo un `active` por merchant (fail-closed al arrancar)           |
| `startedAt`        | `Date`               | RFC 3339 en configuración                                                |

Fuente en esta feature: `MerchantConfig.experiments` (dentro de `OPE_MERCHANTS` /
`OPE_MERCHANTS_FILE`). Puerto `ExperimentDirectory { activeFor(merchantId): Experiment | undefined }`.

## Brazo y asignación

`Arm = "CONTROL" | "TREATMENT"`. `assignArm(experiment, visitorId)`:
`fnv1a32(merchantId ␟ experimentId ␟ seed ␟ visitorId) % 100 < treatmentPercent ? TREATMENT : CONTROL`
(pura; ␟ = U+001F).

| Campo          | Tipo           | Regla                                            |
| -------------- | -------------- | ------------------------------------------------ |
| `merchantId`   | `MerchantId`   | del security handler                             |
| `experimentId` | `ExperimentId` | el activo al asignar                             |
| `visitorId`    | `VisitorId`    | del lote                                         |
| `arm`          | `Arm`          | calculado; el registrado gana ante un desacuerdo |
| `assignedAt`   | `Date`         | `clock.now()` del primer lote aceptado           |

Estado de la cadena de evidencia: `ASSIGNED`. Puerto `AssignmentLedger { record(assignment):
RecordOutcome; find(merchantId, experimentId, visitorId): Assignment | undefined }`; clave
`(merchantId, experimentId, visitorId)`; `record` de una existente conserva la primera y
devuelve `accepted` (idempotencia).

## Resultado de escritura (`application/shared-kernel`)

`RecordOutcome = "accepted" | "unavailable"`. `DecisionLedger.record` y
`AssignmentLedger.record` lo devuelven; `ExposureLedger.record` devuelve
`"recorded" | "already-recorded" | "unavailable"`. En memoria nunca `unavailable`; los ledgers
falsos de las pruebas sí.

## Decisión (ampliada)

`experiment?: { experimentId: ExperimentId; arm: Arm }` — ausente sin experimento activo. No
viaja en el DTO.

## Motivos de `NO_OP` (ampliados)

`control-arm` (emite la asignación), `no-active-experiment` (asignación), `ledger-unavailable`
(orquestador). `decideArm(arm | undefined, batch)`: sin experimento → `no-active-experiment`;
`CONTROL` → `control-arm`; `TREATMENT` → `decide(batch)` de la 004 (`page-context-incomplete`
o `decision-plane-unavailable`).

## Tipo de problema nuevo

`ledger-unavailable` (503) — sólo `confirmExposure` lo emite, con `Retry-After`.

## Flujo de la ingesta

`checkBatch` → `assignVisitor` (→ `NO_OP ledger-unavailable` si el ledger de asignaciones no
acepta) → `eventDedup.claim` → `decideArm` → `noOp({…, experiment})` → `decisions.record` (→
`NO_OP ledger-unavailable`, decisión no registrada) → `IngestResult`.

## Configuración de la prueba de carga

`OPE_LOAD_DURATION` (s, 30), `OPE_LOAD_CONNECTIONS` (20), `OPE_LOAD_VISITORS` (1000).
Salida: `load: <lotes/s> batches/s, p50 <ms>, p95 <ms>, p99 <ms>, errors <n>, non2xx <n>
(<duración> s, <conexiones> connections)`.
