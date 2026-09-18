# Tasks: Dominio rico e invariantes por construcción

**Input**: Design documents from `specs/009-dominio-rico/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (sin `contracts/`
de feature: el contrato sólo gana tres tipos de problema de configuración)

**Tests**: la spec exige regresión de la asignación (FR-041), fixture de la regla (FR-010) y
suite de 001–008 sin cambiar aserciones (FR-040); las tareas de prueba están incluidas.

**Organization**: por historia; la fase fundacional deja los puertos asíncronos y la política
de dedup, que no dependen de las clases y mantienen la suite verde por sí solas.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable · **[Story]**: US1 sólo existe válido · US2 reglas con su dueño ·
  US3 invariantes en su dueño (configuración) · US4 políticas y puertos

## Path Conventions

Proyecto único: `src/`, `tests/`, `scripts/`, `docs/`. Dominio en `src/domain/<módulo>/`.

---

## Phase 1: Setup

- [ ] T001 Generar el fingerprint de la asignación **antes** de tocar el dominio: script
      temporal (no se commitea) que, con el código actual, calcula para tres repartos (50, 20, 80) la secuencia de brazos de 100 000 visitantes `vis_00000001..vis_00100000` con
      `seed: "seed-alpha"`, `merchantId: "m_a"`, `experimentId: "exp_00000001"` y devuelve
      `fnv1a32` de la cadena `"T"|"C"` concatenada; anotar los tres valores para T012

---

## Phase 2: Foundational — puertos asíncronos y política de dedup (US4)

- [ ] T002 [US4] Crear `src/application/ingestion/policies/dedup-window.ts` con
      `DedupWindow { ttlMs; maxIds }` y `DEDUP_WINDOW = { ttlMs: hours(24), maxIds: 100_000 }`;
      exportar desde `src/application/ingestion/index.ts`;
      `src/interface-adapters/gateways/ingestion/memory-event-dedup.ts` recibe `window` sin
      default y deja de declarar la política; `src/composition/modules/ingestion.ts` pasa
      `DEDUP_WINDOW`; adaptar `tests/unit/gateways/*dedup*` sólo en la construcción
- [ ] T003 [US4] Todo puerto devuelve `Promise`: `src/application/merchant/ports/merchant-directory.ts`,
      `src/application/experiment/ports/experiment-directory.ts`,
      `src/application/ingestion/ports/event-dedup.ts`, `src/application/ledger/ports/{decision-ledger,exposure-ledger}.ts`,
      `src/application/experiment/ports/assignment-ledger.ts` (quitar `| X`); `CorsPolicy` en
      `src/infrastructure/http/cors.ts` con `isRegisteredOrigin(): Promise<boolean>` y `origin`
      resolviendo la promesa en el callback; gateways en memoria y de configuración devuelven
      `Promise.resolve(...)`; `tests/helpers/unavailable-ledgers.ts` y los dobles de las
      pruebas unitarias devuelven promesas
- [ ] T004 [US4] `npm run quality && npm test` en verde; commit `refactor(ports): todo puerto
devuelve Promise; la ventana de deduplicación es una política de la aplicación (ADR-024)`

---

## Phase 3: US2 + US1 — Experiment y Merchant como aggregates (Priority: P1)

**Goal**: `Experiment` y `Merchant` sólo existen válidos y las reglas se invocan por su dueño;
asignación idéntica.

**Independent Test**: T012 pasa con el fingerprint de T001; `tests/unit/domain/{experiment,merchant}`
verdes; integración sin cambios.

- [ ] T005 [P] [US1] Mover `NO_OP_REASONS`/`NoOpReason` a `src/domain/shared-kernel/no-op-reasons.ts`
      (exportado por el índice del shared-kernel) y reexportar desde
      `src/domain/ingestion/index.ts`; actualizar `tests/unit/no-op-reasons.test.ts` y la nota de
      CLAUDE.md sobre la réplica del catálogo
- [ ] T006 [P] [US1] Crear `src/domain/experiment/errors.ts`: `InvalidTreatmentShare`
      (`invalid-treatment-share`, `details: { share }`), `InvalidSeed` (`invalid-seed`),
      `module = "experiment"`, unión `ExperimentError`; añadir `InvalidOrigin`
      (`invalid-origin`, `details: { index }`) a `src/domain/merchant/errors.ts`; añadir los
      tres tipos a `contracts/problem-types.yaml` (status 500, títulos en inglés) y a
      `PROBLEM_TYPES` en `src/interface-adapters/http/problem-details.ts`
- [ ] T007 [US1] Reescribir `src/domain/experiment/experiment.ts`: `class Experiment` con
      `private constructor`, campos `readonly` (`experimentId`, `merchantId`, `treatmentShare`
      0–1, `seed`, `status`, `startedAt`), `static of(input): Result<Experiment, ExperimentError>`
      (`Number.isFinite(share) && 0 ≤ share ≤ 1`; `seed.length > 0`), `static rehydrate(record)`,
      `assign(visitorId): Arm` (`fnv1a32(key) % 100 < treatmentShare * 100`, clave con U+001F),
      `isActive()`; `fnv1a32` y la clave como funciones **no exportadas** (eliminar
      `assignment.ts` o dejar sólo `Assignment` tipo en `assignment.ts`); actualizar
      `src/domain/experiment/index.ts` (sin `assignArm`, `assignmentKey`, `fnv1a32`, `activeExperiment`)
- [ ] T008 [US2] Crear `src/domain/merchant/origin.ts`: `class Origin` con `private constructor`,
      `static parse(text): Origin | undefined` (misma regex y normalización que `normalizeOrigin`),
      `value`, `equals(other)`; reescribir `src/domain/merchant/merchant.ts`: `class Merchant`
      con `of({ merchantId, ingestKeys, origins: readonly string[] }): Result<Merchant, MerchantError>`
      (`Origin.parse` por origen; el primero inválido → `InvalidOrigin(index)`), `rehydrate`,
      `owns(key)`, `allowsOrigin(text)`, `origins: readonly Origin[]`; eliminar `normalizeOrigin`,
      `originAllowed`, `findByIngestKey` del índice
- [ ] T009 [US3] `src/composition/config.ts`: construir `Experiment.of` (con
      `treatmentShare = percent / 100`) y `Merchant.of` durante el parseo; un `fail` →
      `ConfigError(campo, error.message)` con el campo derivado del `code`
      (`merchants[i].experiments[j].treatmentPercent`, `…seed`, `merchants[i].origins[k]`);
      las validaciones de rango/normalización propias de `config.ts` desaparecen (quedan las de
      forma JSON); `MerchantConfig` pasa a contener `Merchant` y `Experiment[]` (o
      `readConfig` devuelve entidades); adaptar `tests/unit/composition/config.test.ts` sólo en
      la forma esperada del resultado, manteniendo los casos de error (campo citado)
- [ ] T010 [US3] Gateways de configuración reciben entidades:
      `src/interface-adapters/gateways/merchant/config-merchant-directory.ts` (`Merchant[]`;
      `findByIngestKey` por `merchant.owns(key)`; `isRegisteredOrigin` por `Origin.parse` +
      `equals` sobre los orígenes ya normalizados) y
      `src/interface-adapters/gateways/experiment/config-experiment-directory.ts`
      (`Map<MerchantId, Experiment>` con `experiments.find((e) => e.isActive())`); eliminar
      `MerchantRecord`, `ExperimentRecord`, `MerchantExperiments`; `src/composition/modules/{merchant,experiment}.ts`
      y `tests/helpers/test-app.ts` pasan entidades
- [ ] T011 [US2] `src/application/experiment/services/assignment.service.ts` usa
      `experiment.assign(visitorId)`; `src/application/merchant/services/ingest-key.service.ts`
      usa `merchant.allowsOrigin(origin)` (el directorio ya resolvió `owns`)
- [ ] T012 [US2] Prueba de regresión `tests/unit/domain/experiment/assignment-regression.test.ts`:
      para los tres repartos, `fnv1a32` de la secuencia de brazos de 100 000 visitantes igual
      al fingerprint de T001 (constantes en el test con la fecha de generación); reescribir
      `tests/unit/domain/experiment/assignment.test.ts` contra `Experiment.of(...).assign(...)`
      (mismas propiedades: determinismo, reparto ±1 pp, independencia entre merchants, 0 y 1)
- [ ] T013 [P] [US1] Pruebas `tests/unit/domain/experiment/experiment.test.ts` (`of` rechaza
      share −0.1, 1.5, NaN y seed vacía con el `code` correcto; `rehydrate` no valida;
      `isActive`) y `tests/unit/domain/merchant/merchant.test.ts` reescrita contra
      `Merchant.of`/`Origin.parse` (mismos casos de normalización y `allowsOrigin`; `of` con
      origen inválido → `invalid-origin` con `details.index`; `rehydrate`)
- [ ] T014 [US1] `npm run quality && npm test` en verde; commit `refactor(domain): Experiment y
Merchant como aggregates con invariantes por construcción; configuración fail-closed por
fábrica (ADR-024)`

---

## Phase 4: US1 — EventBatch y Decision (Priority: P1)

**Goal**: el lote y la decisión sólo existen válidos; los casos de uso preguntan al dueño.

**Independent Test**: `tests/unit/domain/{ingestion,ledger}` verdes; `tests/integration` sin
cambios en aserciones; Schemathesis verde.

- [ ] T015 [US1] Crear `src/domain/ingestion/event-batch.ts`: `class EventBatch` con
      `private constructor`, `static of(events, now): Result<EventBatch, IngestionError>`
      (vacío → `throw new Error`; coherencia → `SessionVisitorMismatch(eventId)`; tolerancia →
      `EventTimestampOutOfRange(eventId)`; `TIMESTAMP_TOLERANCE` se queda como constante
      exportada), `events`, `sessionId`, `visitorId`, `eventIds()`, `noOpReason()` (lógica de
      `decide`) con comentario `PROPUESTO (ADR-024): se muda al módulo decision con la 011`;
      eliminar `batch.ts` y `decide.ts`; `src/domain/ingestion/index.ts` exporta `EventBatch`,
      `TIMESTAMP_TOLERANCE` y deja de exportar `checkBatch`, `decide`, `decideArm`
- [ ] T016 [US1] Reescribir `src/domain/ledger/decision.ts`: `abstract class DecisionBase`
      (`decisionId`, `merchantId`, `sessionId`, `visitorId`, `decidedAt`, `experiment?`,
      `belongsTo(sessionId, visitorId)`, `isIntervention(): this is InterveneDecision`,
      `static rehydrate(record: DecisionRecord): Decision` que discrimina por `outcome` y lanza
      si `INTERVENE` sin intervención), `class NoOpDecision` (`outcome = "NO_OP"`,
      `reason: NoOpReason`, `static of`), `class InterveneDecision` (`outcome = "INTERVENE"`,
      `intervention`, `static of`), `type Decision`, `DecisionRecord`; eliminar `noOp` y
      `NoOpInput`; actualizar `src/domain/ledger/index.ts`
- [ ] T017 [US1] `src/application/ingestion/use-cases/ingest-batch.use-case.ts`:
      `IngestBatchRequest { merchantId; events: readonly Event[] }`; `EventBatch.of(events,
now)` → `fail` si falla; motivo: `assignment === undefined ? "no-active-experiment" : arm ===
"CONTROL" ? "control-arm" : batch.noOpReason()`; `NoOpDecision.of({...})`; dedup con
      `batch.eventIds()`
- [ ] T018 [US1] `src/application/ledger/use-cases/confirm-exposure.use-case.ts`:
      `if (!decision || !decision.belongsTo(sessionId, visitorId)) → ExposureDecisionUnknown`;
      `if (!decision.isIntervention()) → ExposureOfNoOp`
- [ ] T019 [US1] Controllers: `src/interface-adapters/http/controllers/ingestion/ingest-events.ts`
      pasa `events` (no `{ events }`), guarda `NaN` en `toDomainEvent` (`throw new Error`) y
      `toDecisionDto` sobre la unión (`reason` de `NoOpDecision`; `intervention` de
      `InterveneDecision`; `reason` del DTO para INTERVENE se mantiene como hoy si el DTO lo
      exige — verificar el schema `Decision`); `controllers/ledger/confirm-exposure.ts` guarda
      `NaN` de `exposedAt`
- [ ] T020 [US1] Gateways y pruebas: `memory-decision-ledger.ts` sin cambio de firma;
      `tests/unit/domain/ingestion/batch.test.ts` → `event-batch.test.ts` contra `EventBatch.of`
      (mismos casos + `noOpReason` de `decide.test.ts` si existe + lote vacío lanza);
      `tests/unit/domain/ledger/decision.test.ts` contra las clases (`of`, `rehydrate`,
      `belongsTo`, `isIntervention`, INTERVENE sin intervención al rehidratar lanza);
      `tests/unit/application/**` y `tests/integration/**` que construyen decisiones literales
      (`intervene()`, `decision({...})`) pasan a `InterveneDecision.of`/`DecisionBase.rehydrate`
      **sin tocar aserciones**; `tests/helpers/test-app.ts` si construye decisiones
- [ ] T021 [US1] `npm run quality && npm test && npm run test:contract` en verde; verificar
      `git diff main -- tests/integration tests/contract-rules contracts/paths contracts/components | grep -c "^[-+] *expect"`
      → 0; commit `refactor(domain): EventBatch y Decision con invariantes por construcción;
los casos de uso preguntan al dueño (ADR-024)`

---

## Phase 5: US2 — Regla "sin funciones sueltas" y limpieza (Priority: P1)

- [ ] T022 [US2] Regla ESLint `scripts/lint/domain-no-loose-functions.mjs`
      (`ope/domain-no-loose-functions`, AST sin tipos): en `**/domain/**/*.ts` reporta
      `export function` y `export const x = <ArrowFunctionExpression|FunctionExpression>`;
      opción `allow: string[]` (sufijos de ruta) con `shared-kernel/ids.ts`,
      `shared-kernel/result.ts`, `shared-kernel/time.ts`; registrar en `scripts/lint/plugin.mjs`
      y en `DOMAIN_RULES` de `eslint.config.mjs`; fixture
      `tests/lint/fixtures/as-src/domain/demo/loose-function.ts` + entrada en `expected` de
      `tests/lint/lint.test.ts`
- [ ] T023 [US2] Limpieza: `src/domain/system/health.ts` sólo tipos (`serviceHealth` desaparece;
      `GetServiceHealthUseCase` construye el valor); `src/application/system/index.ts`;
      `tests/unit/domain-health.test.ts` adaptada o eliminada si sólo probaba la función; `npm
run lint` en 0 sobre `src/domain`
- [ ] T024 [US2] `npm run quality && npm test` en verde; commit `feat(lint): el dominio no
exporta funciones sueltas (ADR-024)`

---

## Phase 6: Polish

- [ ] T025 [P] `docs/adr/024-dominio-rico.md`: `estado: aceptada`; ajustar detalles si la
      implementación cambió nombres; el `PROPUESTO` del stub de decisión se queda
- [ ] T026 [P] `CLAUDE.md`: sección "Cómo se escribe una entidad" (clase si hay reglas, `of` →
      `Result`, `rehydrate`, errores en `errors.ts` + catálogo, sin funciones sueltas, políticas
      publicadas en dominio/aplicación, puertos `Promise`); actualizar "Asignación (ADR-022)"
      (`treatmentShare`), la nota de réplica del catálogo de motivos (nuevo path) y la tabla de
      reglas `ope/*`
- [ ] T027 `npm run test:mutation` sobre el diff; matar supervivientes con aserciones
- [ ] T028 `specs/009-dominio-rico/quickstart.md`: "Estado al cierre" con fecha y resultados
- [ ] T029 Commit `chore(009): ADR-024 aceptada, guía de agentes y cierre de la feature`;
      `npm run release-check` en verde; PR a `main`, CI verde, merge

---

## Dependencies & Execution Order

- Phase 1 (T001) antes que cualquier cambio en `domain/experiment`.
- Phase 2 (T002–T004) independiente de las clases; deja la suite verde.
- Phase 3: T005–T006 en paralelo → T007, T008 → T009 → T010 → T011 → T012–T013 → T014.
- Phase 4: T015–T016 en paralelo (T016 depende de T005 por `NoOpReason`) → T017–T018 → T019 →
  T020 → T021.
- Phase 5: T022 en paralelo con Phase 4; T023 después de T021.
- Phase 6: al final.

## Implementation Strategy

1. **MVP = Phase 2 + Phase 3**: puertos asíncronos, y `Experiment`/`Merchant` como aggregates
   con la regresión de asignación en verde.
2. Phase 4 completa la garantía sobre el lote y la decisión.
3. Phase 5 hace cumplir la forma por herramienta.
4. Un commit por fase, siempre con `quality` y `test` en verde; sin cambios en `contracts/`
   salvo `problem-types.yaml`.

## Notes

- Las pruebas de dominio se reescriben contra las clases (misma cobertura de casos); las de
  integración y contrato no cambian sus aserciones (FR-040).
- `new` de clases del dominio fuera de composición no viola `new-only-in-composition` (sólo
  mira paquetes npm).
