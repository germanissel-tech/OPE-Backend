# Implementation Plan: Asignación experimental y ledger

**Branch**: `007-asignacion-experimental` | **Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-asignacion-experimental/spec.md`

## Summary

Primer paso del camino crítico y primer estado de la cadena de evidencia: un módulo
`experiment` con experimentos por configuración y asignación determinista y estable de cada
visitante a un brazo (FNV-1a puro en el dominio, verificado sobre 100 000 visitantes), la
asignación registrada en el ledger con el primer lote aceptado (idempotente), la decisión con
brazo y experimento, CONTROL siempre `NO_OP` con motivo `control-arm` (visible al SDK, decisión
del usuario), y dos decisiones que la persistencia real necesita ya tomadas: la semántica de
escritura del ledger (`accepted | unavailable`, fail-closed con `NO_OP` `ledger-unavailable`
en la ingesta y `503` en la exposición; ADR-021) y una prueba de carga informativa con
autocannon. Evidencia en [research.md](research.md).

## Technical Context

**Language/Version**: Node.js 22, TypeScript 7 / API 6 para herramientas (sin cambio)

**Primary Dependencies**: las existentes + `autocannon@^8` (dev, prueba de carga)

**Storage**: en memoria detrás de puertos (`AssignmentLedger` nuevo; `DecisionLedger`,
`ExposureLedger` con resultado de escritura); la persistencia real es la 008

**Testing**: Vitest (unitarias de dominio con 100 000 visitantes, aplicación con ledgers falsos,
integración con `startTestApp` y overrides de puertos), Schemathesis (la `503` nueva de
`confirmExposure`), `npm run test:load` fuera de la suite

**Target Platform**: sin cambio

**Project Type**: web-service (backend HTTP contract-first)

**Performance Goals**: SC-005 — p95 de la ingesta ≤ 110 % del de la 004 (umbral 50 ms se
mantiene) y sin diferencia entre brazos; SC-006 — prueba de carga con cifras registradas

**Constraints**: el brazo y el experimento nunca viajan como campos HTTP; asignación sin I/O de
red ni estado compartido; dominio puro (hash en TypeScript, sin `node:crypto`); un solo
catálogo de motivos visible al SDK; contrato compatible (versión sigue 1.1.0: sólo una
respuesta `503` nueva, un tipo de problema y tres motivos); mapa del contrato sin cambios
(ninguna operación nueva)

**Scale/Scope**: 1 módulo nuevo (`experiment`) en dominio, aplicación, gateways y composición;
1 puerto nuevo + 3 firmas de `record()` cambiadas; configuración de experimentos con
validación; 3 motivos y 1 tipo de problema; 1 respuesta nueva en el contrato; 2 ADRs; 6 notas
de glosario; ~10 archivos de prueba; 1 script de carga + 1 lib compartida de arranque

## Constitution Check

| Gate                                          | ¿Aplica? | Cómo se cumple                                                                                                                                                                                                                 |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Superficie HTTP → contrato primero            | **Sí**   | `confirmExposure` gana `503` (`ServiceUnavailable`, tipo `ledger-unavailable`); catálogo de motivos +3; diseño en [contracts/](contracts/), `contract:check` verde antes del código. Mapa sin cambios (operaciones ya `built`) |
| Persistencia / API → aislamiento por merchant | **Sí**   | FR-050: mismo visitante en A y B → asignaciones independientes; `AssignmentLedger.find` con otro merchant → `undefined`; experimentos cerrado/activo no comparten asignaciones; suite `isolation.test.ts` ampliada             |
| Plano de decisión / ledger / campos / LLM     | **Sí**   | Constitución III: asignación determinista y estable por `visitorId`, registrada al asignar; CONTROL recorre el pipeline y resuelve `NO_OP`; ledger no disponible ⇒ intervención suprimida (II); cero red en el camino crítico  |
| `x-invariants`                                | No       | Sin reglas de negocio nuevas sobre requests: la `503` es degradación, no invariante; las propiedades de la asignación se prueban con pruebas nombradas (FR-052)                                                                |
| Sustantivo nuevo en el contrato (glosario)    | Parcial  | El contrato no gana sustantivos (`ServiceUnavailable` es respuesta, no schema nuevo… salvo el `$ref` a `ProblemDetails` existente); las notas de R-07 entran igual con `uso: disponible` (FR-051)                              |
| Toca `src/` → dirección de dependencias       | **Sí**   | Módulo `experiment` en el mapa de contextos (`experiment: [shared-kernel]`, `ingestion` gana `experiment`); `npm run arch` en 0; fixtures de arquitectura sin cambio (las reglas son las mismas)                               |
| Privacidad (V, VII)                           | **Sí**   | El brazo no sale del backend como campo; `assignment-drift` se loguea con `merchantId` y `experimentId`, nunca con `visitorId`                                                                                                 |

**Resultado pre-Phase 0**: PASA. **Post-Phase 1**: PASA.

## Project Structure

### Documentation (this feature)

```text
specs/007-asignacion-experimental/
├── plan.md, spec.md, research.md, data-model.md, quickstart.md
├── checklists/requirements.md
├── contracts/
│   ├── components/responses/ServiceUnavailable.yaml   # 503 ledger-unavailable con Retry-After
│   ├── paths/exposures.additions.md                    # la respuesta 503 en confirmExposure
│   ├── no-op-reasons.additions.yaml                    # control-arm, no-active-experiment, ledger-unavailable
│   └── problem-types.additions.yaml                    # ledger-unavailable (503)
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── domain/experiment/            index.ts, experiment.ts (Experiment, Arm, activeExperiment), assignment.ts (fnv1a32, assignArm, Assignment)
├── domain/ledger/decision.ts     + experiment?: { experimentId, arm }
├── domain/ingestion/decide.ts    + decideArm(arm | undefined, batch) → NoOpReason (control-arm | no-active-experiment | lo existente)
├── domain/ingestion/no-op-reasons.ts   + control-arm, no-active-experiment, ledger-unavailable
├── application/shared-kernel/    ports/record-outcome.ts (RecordOutcome = accepted | unavailable) exportado por index
├── application/experiment/       index.ts, ports/experiment-directory.ts, ports/assignment-ledger.ts, assign-visitor.ts
├── application/ledger/ports/     decision-ledger.ts, exposure-ledger.ts (record → outcome con unavailable)
├── application/ingestion/ingest-batch.ts   asignación antes de decidir; NO_OP ledger-unavailable; decisión con experimento
├── application/ledger/confirm-exposure.ts  resultado ledger-unavailable → controller 503
├── interface-adapters/gateways/experiment/ config-experiment-directory.ts, memory-assignment-ledger.ts
├── interface-adapters/http/controllers/    ledger/confirm-exposure.ts (503), ingestion/ingest-events.ts (sin cambio de DTO)
└── composition/                  config.ts (experiments), modules/experiment.ts (ExperimentPorts + memoryExperimentPorts), modules/ingestion.ts (+ assignVisitor), ports.ts, profiles/local.ts
.dependency-cruiser.cjs           CONTEXT_MAP: experiment, ingestion
contracts/                        exposures.yaml (+503), components/responses/ServiceUnavailable.yaml, problem-types.yaml, no-op-reasons.yaml
scripts/server-lib.mjs            arranque del servidor construido + espera de salud (de test-contract.mjs)
scripts/load-test.mjs             npm run test:load (autocannon)
docs/adr/021-semantica-de-escritura-del-ledger.md, 022-asignacion-experimental.md
docs/dominio/{experimento,asignacion,brazo,grupo-de-control,grupo-de-tratamiento,intencion-de-tratar}.md
tests/
├── unit/domain/experiment/assignment.test.ts     determinismo, reparto (3 repartos × 100k), independencia, bordes 0/100
├── unit/application/experiment/assign-visitor.test.ts   primera vez registra; segunda no; ledger no disponible; sin experimento activo; drift
├── unit/gateways/memory-assignment-ledger.test.ts
├── unit/composition/config.test.ts (+ experimentos: dos activos, campos inválidos, por defecto 50)
├── integration/assignment.test.ts     ASSIGNED con el primer lote, idempotente, lote rechazado no asigna, cerrado/activo, CONTROL → control-arm, TREATMENT → decision-plane-unavailable, decisión con brazo en el ledger, ningún campo arm/experimentId en respuestas
├── integration/ledger-unavailable.test.ts   ingesta → 202 NO_OP ledger-unavailable sin registros; exposición → 503 con Retry-After; recuperación
├── integration/isolation.test.ts (+ asignaciones)
├── integration/ingest-latency.test.ts (+ p95 por brazo)
└── unit/no-op-reasons.test.ts (réplica del catálogo, ya existe: se amplía sola)
```

**Structure Decision**: un módulo más dentro de los anillos, con la misma forma que los de la
004/005 (dominio puro, puertos en aplicación, gateway en memoria, `modules/experiment.ts` en
composición con su tabla de bindings). Sin carpetas nuevas fuera de los anillos.

### Comandos npm (cambios)

| Comando         | Cambio                                                                             |
| --------------- | ---------------------------------------------------------------------------------- |
| `test:load`     | nuevo: `node scripts/load-test.mjs` (informativo; no corre en `npm test` ni en CI) |
| `test:contract` | sin cambio de invocación; comparte `scripts/server-lib.mjs` con `test:load`        |

## Diseño de los puntos no triviales

- **`assignArm`** (R-01): `fnv1a32(`${merchantId}${experimentId}${seed}${visitorId}`) % 100 < treatmentPercent`. Pura, sin dependencias. Los repartos 0 y 100 son válidos.
- **`assignVisitor`** (aplicación): `directory.activeFor(merchantId)` → sin experimento ⇒
  `{ ok: true, assignment: undefined }`; con experimento: `ledger.find` → si existe, devolverla
  (si el brazo calculado difiere, gana la registrada y se loguea `assignment-drift`); si no,
  `assignArm` + `ledger.record` → `accepted` ⇒ asignación; `unavailable` ⇒ `{ ok: false,
reason: "ledger-unavailable" }`.
- **Ingesta** (R-03): `checkBatch` → `assignVisitor` → dedup → `decideArm` → `noOp({ …,
experiment })` → `decisions.record` (`unavailable` ⇒ resultado `NO_OP ledger-unavailable`
  con decisión no registrada). El DTO de la decisión no cambia: `arm` y `experimentId` quedan
  en el ledger. `toDecisionDto` no copia `experiment`.
- **Exposición**: `exposures.record` → `unavailable` ⇒ `{ ok: false, unavailable: true }` →
  controller `503` con `Retry-After: 5` y `type: urn:ope:problem:ledger-unavailable`. La
  regla `ope-required-error-responses` no exige 503; se declara sólo donde aplica.
- **Configuración** (R-04): `experiments` opcional por merchant; `ConfigError` fail-closed
  para dos activos o campos inválidos; `ExperimentDirectory` de configuración expone
  `activeFor(merchantId)`.
- **Carga** (R-05): `server-lib.mjs` (`startBuiltServer({ env }) → { base, stop }`,
  `waitForHealth`) extraída de `test-contract.mjs`; `load-test.mjs` con autocannon y
  `setupRequest` que genera `eventId` únicos (`evt_<n>`), `visitorId` rotando entre 1000
  visitantes (mezcla asignaciones nuevas y existentes), sesión por conexión.
- **Orden de commits**: (1) contrato + catálogos + glosario + ADRs (`503`, motivos, tipo) con
  la réplica en `problem-details.ts`; (2) semántica de escritura: `RecordOutcome`, firmas de
  los puertos, ledgers falsos, degradación en ingesta y exposición (US4); (3) módulo
  `experiment`: dominio, aplicación, gateways, configuración, composición, ingesta con
  asignación (US1–US3), aislamiento, latencia por brazo; (4) prueba de carga, README,
  CLAUDE.md, quickstart con cifras.

## Complexity Tracking

| Elemento                               | Por qué                                                                                                     | Alternativa rechazada                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Hash propio en el dominio              | el dominio no importa Node (ADR-013) y la asignación debe ser pura y portable                               | puerto `Hasher` + gateway `node:crypto`: un puerto para ocho líneas puras, y SHA-256 8× más lento sin ganancia (R-01) |
| `503` sólo en `confirmExposure`        | el SDK tiene que reintentar una exposición no registrada; la ingesta degrada a `NO_OP` por diseño (01 §4.7) | `503` también en ingesta: contradice la spec aprobada (US4) y haría al SDK reintentar lotes ya deduplicados           |
| Experimentos dentro de `OPE_MERCHANTS` | un solo origen de configuración validado fail-closed                                                        | variable aparte: dos fuentes que pueden contradecirse                                                                 |

## Re-evaluación del Constitution Check (post-Phase 1)

Contrato compatible (`contract:diff` sin incompatibles), mapa sin cambios, módulo nuevo dentro
del mapa de contextos, asignación conforme a III y verificada con propiedades, degradación
conforme a II. **PASA.**
