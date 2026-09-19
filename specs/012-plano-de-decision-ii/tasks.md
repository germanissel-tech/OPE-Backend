# Tasks: Plano de decisión II — selección, quality gate y política comercial

**Input**: Design documents from `specs/012-plano-de-decision-ii/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: la spec exige tablas (SC-001), pureza y determinismo del gate (SC-002), políticas
inválidas nombradas (SC-003), la suite de la 011 sin cambios de `outcome`/`reason` (SC-004),
latencia (SC-005), aislamiento y réplicas; las tareas de prueba están incluidas.

**Organization**: por historia; la fase fundacional refactoriza `decision`, `ledger`, `barrier`
y el kernel sin cambiar el comportamiento (commit 1); US1 (selección + gate) es dominio puro
sin cablear (commit 2); US2 + US3 + US4 cablean la política comercial y el orquestador (commit
3); polish (commit 4).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable · **[Story]**: US1 quality gate · US2 política comercial · US3 abandono
  como amplificador · US4 trazabilidad en el ledger

## Path Conventions

Proyecto único. Módulos nuevos sólo de dominio: `src/domain/selection/`, `src/domain/commercial/`.
Sin controllers ni operaciones nuevas.

---

## Phase 1: Setup

- [x] T001 Verificar el punto de partida (`npm run contract:check && npm run quality && npm test`
      en verde) y anotar la cantidad de pruebas en la sección histórica de
      `specs/012-plano-de-decision-ii/quickstart.md`

---

## Phase 2: Foundational — refactor sin cambio de comportamiento

- [x] T002 [P] `src/domain/barrier/condition.ts`: exportar `class Conditions { static check(condition,
path): UnknownFact | InvalidRuleThreshold | undefined }` moviendo `checkCondition`/`checkList`/
      `checkFact`/`checkRef` desde `barrier-rules.ts` (con `index` como parámetro opcional en los
      errores: `details` sólo lleva `index` cuando se pasa); `BarrierRules.of` lo usa; exportar
      desde `src/domain/barrier/index.ts`; `tests/unit/domain/barrier/barrier-rules.test.ts`
      sigue igual y `tests/unit/domain/barrier/condition.test.ts` gana casos de `Conditions.check`
      (válida ⇒ `undefined`; bloque y subtipo desconocidos con `path`)
- [x] T003 [P] Kernel: `src/domain/shared-kernel/intervention.ts` gana `Incentive = { kind:
"percent"; value: number }` e `Intervention.incentive?: Incentive`; `no-op-reasons.ts` gana
      `no-acceptable-candidate`, `commercial-policy-blocked`, `visitor-fatigue` **junto con**
      `contracts/no-op-reasons.yaml` (de `contracts/no-op-reasons.additions.yaml`); exportar
      `Incentive` desde el índice
- [x] T004 [P] Contrato: `contracts/components/schemas/Incentive.yaml` (de
      `specs/012-plano-de-decision-ii/contracts/Incentive.yaml`), `Intervention.yaml` con
      `incentive` y la descripción nueva (`intervention.additions.yaml`); un ejemplo de
      `IngestResult` con intervención con incentivo en `contracts/examples/` referenciado desde
      la operación; `contracts/problem-types.yaml` + los 7 tipos de
      `problem-types.additions.yaml` y `PROBLEM_TYPES` en
      `src/interface-adapters/http/problem-details.ts`; `npm run contract:check` (diff
      compatible) y `npm run contract:types`; `tests/unit/anchors.test.ts` no cambia; nueva
      réplica `tests/unit/incentive.test.ts` (el `kind` del kernel es el `enum` del contrato y
      el rango 1–100)
- [x] T005 [P] Ledger: `src/domain/ledger/decision.ts` gana `DecisionSelection { candidates:
readonly { candidateId: string; step: string; verdict: "acceptable" | "unacceptable"; reason?:
string }[]; chosen?: string; commercialVerdict: { blocked: boolean; reason?: string };
commercialPolicyVersion: string }` y `DecisionFacts.selection?`, copiado en el constructor y
      conservado por `rehydrate`; exportar; `tests/unit/domain/ledger/decision.test.ts` (+
      `selection` en `rehydrate`; sin la clave cuando no se dio)
- [x] T006 [P] `src/domain/decision/session-state.ts`: `lastInterventionAt?: Date` en el record
      y en la clase; `withIntervention(now)` lo fija; `tests/unit/domain/decision/session-state.test.ts`
- [x] T007 [P] `src/domain/decision/visitor-state.ts`: `class VisitorState { static empty();
static rehydrate({ interventions }); countSince(now, windowMs); withIntervention(now, windowMs)
(poda lo anterior a la ventana); interventions }`; exportar; `tests/unit/domain/decision/visitor-state.test.ts`
      (poda, conteo, inmutabilidad)
- [x] T008 `src/domain/decision/decision-policy.ts`: `verdict` → `barrierVerdict(input: {
inference; truth; focusHasVariant }) → BarrierVerdict { barrier?; confidence?; trigger: "rules" |
"none"; evidenceReason?: NoOpReason }` (dominante por umbral y prioridad; evidencia por barrera
      como hoy); quitar `highIntent`, `abandonment`, `interventionsPerSession`, `anchorFor`,
      `messageFor`, `ANCHOR_BY_BARRIER`, `HighIntent`, `Abandonment` (se mudan a `commercial` en
      T015); `default-policy.ts` sin esos campos (versión sigue `default-1`);
      `tests/unit/domain/decision/verdict.test.ts` → `barrier-verdict.test.ts` (sólo barrera y
      evidencia); `decision-policy.test.ts` y `default-policy.test.ts` adaptados
- [x] T009 Aplicación `decision` (el `DecisionPolicyDirectory` de la 011 sigue igual hasta
      T017): `ports/visitor-state-store.ts`, `policies/visitor-window.ts`
      (`VISITOR_WINDOW = { ttlMs: hours(24), maxVisitors: 100_000 }`),
      `services/state.service.ts` (`StateService { recall(merchantId, sessionId, visitorId,
now): Promise<{ session: SessionState; visitor: VisitorState }>; remember(merchantId,
sessionId, visitorId, state) }`, `DefaultStateService({ sessions, visitors })`); gateway
      `src/interface-adapters/gateways/decision/memory-visitor-state-store.ts` (mismo patrón que
      el de sesión); `DecisionService` con deps `{ assignment, policies, state, inference, truth,
recorder }` reproduciendo el comportamiento de la 011 con `barrierVerdict` + las reglas
      comerciales **temporalmente** dentro del orquestador (alta intención, presupuesto, abandono)
      para que la suite siga verde; `modules/decision.ts` y `profiles/local.ts` con el store de
      visitante; `tests/unit/application/decision/{state.service,decision.service}.test.ts`,
      `tests/unit/gateways/memory-visitor-state-store.test.ts`
- [x] T010 `npm run quality && npm test && npm run contract:check` en verde; `npm run
test:mutation` (con los archivos nuevos en el índice); commit `refactor(decision): veredicto de
barrera separado de lo comercial, estado por visitante, incentivo en el contrato y selección en
el ledger`

---

## Phase 3: US1 — El quality gate deja pasar sólo lo que la evidencia sostiene (Priority: P1)

**Goal**: el módulo `selection` como dominio puro: candidatos, claims, perfil y gate.

**Independent Test**: tabla del gate (cada claim aceptado y rechazado con su motivo);
catálogo de candidatos con sus invariantes; determinismo (SC-002).

- [x] T011 [P] [US1] `src/domain/selection/candidate.ts`: `STEPS`, `Step`, `Claim`,
      `ATTRIBUTE_CLAIM_PREFIX`, `Candidate`, `CANDIDATES` (R-03: 3 de `fit`, 3 de `price`, 2 de
      `returns`, ids `msg_<barrera>_<anclaje>_<escalón>_v0`); `profile.ts` (`MerchantProfile`,
      `EMPTY_PROFILE`); `CONTEXT_MAP.selection = ["shared-kernel"]`;
      `tests/unit/domain/selection/candidates.test.ts` (ids únicos; cada lista ordenada por
      `STEPS`; `barrier` coincide con la clave; claim `incentive` sólo en `price`; ningún claim
      repetido en un candidato)
- [x] T012 [P] [US1] `src/domain/selection/quality-gate.ts`: `GateEvidence`, `GateRejection`,
      `GateVerdict`, `Judged`, `class QualityGate { static judge(candidate, evidence, profile);
static judgeAll(candidates, evidence, profile) }` con las reglas de R-04 (primer rechazo en
      orden de claims); `index.ts`; `tests/unit/domain/selection/quality-gate.test.ts` (tabla:
      cada claim × evidencia/perfil ⇒ aceptable o motivo; candidato sin claims siempre
      aceptable; candidato de prueba con `product-attribute:material` ⇒ `attribute-unknown` /
      `attribute-not-authorized` / aceptable; `judgeAll` conserva el orden; 1 000 evaluaciones
      iguales)
- [x] T013 [US1] `npm run quality && npm test` en verde; `npm run test:mutation`; commit
      `feat(selection): candidatos con clases de claim y quality gate puro (ADR-027)`

---

## Phase 4: US2 — La política comercial emite el veredicto (Priority: P1)

**Goal**: `CommercialPolicy` validada por construcción, el veredicto con su orden de bloqueos,
la configuración y el orquestador con las cinco autoridades.

**Independent Test**: tabla del veredicto (historias 2 y 3); ≥ 8 políticas inválidas;
integración con incentivo, bloqueos, cooldown y fatiga; la suite de la 011 con los mismos
`outcome`/`reason`.

- [x] T014 [P] [US2] `src/domain/commercial/errors.ts` (`InvalidCommercialVersion`,
      `InvalidIncentiveCeiling`, `InvalidIncentiveLadder { index }`, `InvalidMargin`,
      `InvalidReturnRisk { path }`, `InvalidInterventionBudget { path }`, `InvalidCooldown`;
      `module = "commercial"`; unión `CommercialError`)
- [x] T015 [US2] `src/domain/commercial/commercial-policy.ts`: `HighIntent`, `Abandonment`
      (mudados), `CommercialPolicyRecord`, `CommercialInput`, `CommercialVerdict`,
      `BlockReason`, `ANCHOR_BY_BARRIER` (mudado), `class CommercialPolicy { static of → Result
(invariantes de data-model); static rehydrate; fallbackBarrier(barrier, abandoned);
verdict(input) }` con el orden de R-05 (sin experimento → CONTROL → alta intención →
      presupuesto/cooldown → fatiga → sin barrera → `evidenceReason` → sin aceptables → elección
      por escalera con D-B e incentivo directo → bloqueos económicos sobre `incentive` → intervene
      con `incentive { kind: "percent", value: escalón[0] }`); `default-commercial-policy.ts`
      (`DEFAULT_COMMERCIAL_POLICY`, `commercial-default-1`, R-05); `index.ts`;
      `CONTEXT_MAP.commercial = ["shared-kernel", "barrier", "selection"]` y `decision` suma
      `selection` y `commercial`; `tests/unit/domain/commercial/commercial-policy.test.ts` (≥ 8
      rechazos con `code` y `details`; `rehydrate`), `verdict.test.ts` (tabla: escenarios 1–8
      de la historia 2, 1–3 de la historia 3, orden de bloqueos, `chosen`/`blocked`, valor del
      incentivo, sin incentivo fuera de `price`), `default-policy.test.ts`
- [x] T016 [US2] Configuración: `src/composition/condition-config.ts` (mover `condition()` y
      sus helpers desde `decision-policy-config.ts`), `src/composition/commercial-policy-config.ts`
      (`parseCommercialPolicy(value, at)` → `CommercialPolicy.of`; `rejected` con `path`/`index`
      como en la de decisión), `config.ts`: `MerchantConfig.commercialPolicy?`,
      `evidenceProfile?` (`parseEvidenceProfile`: booleanos y `string[]`, ausentes ⇒ falso /
      vacío) y **rechazo** de `highIntent`, `abandonment`, `interventionsPerSession` dentro de
      `decisionPolicy` (`ConfigError`: "moved to commercialPolicy"); `decision-policy-config.ts`
      sin esos campos; `tests/unit/composition/config.test.ts` (+ política comercial válida con
      defaults; ≥ 6 rechazos con el campo; perfil; campos migrados rechazados);
      `tests/helpers/test-app.ts`: `MerchantSpec.commercialPolicy?`, `evidenceProfile?`; A y B
      con `evidenceProfile: { returnsPolicy: true, fitData: true }`; `config/dev-merchants.json`
      con `evidenceProfile` y `commercialPolicy` con `marginPercent: 40`
- [x] T017 [US2] Directorio y orquestador: `application/decision/ports/policy-directory.ts` con
      `MerchantPolicies { decision; commercial; profile }`; gateway
      `interface-adapters/gateways/decision/config-policy-directory.ts` (reemplaza a
      `config-decision-policy-directory.ts`; defaults `DEFAULT_DECISION_POLICY`,
      `DEFAULT_COMMERCIAL_POLICY`, `EMPTY_PROFILE`); `DecisionService.decide` con las cinco
      autoridades (plan § Diseño): `barrierVerdict` → `fallbackBarrier` → `GateEvidence` desde
      `ProductTruth` → `QualityGate.judgeAll(CANDIDATES[barrier])` → `commercial.verdict({...})`
      → `record` con `inference` + `selection` (`candidates`, `chosen`, `commercialVerdict`,
      `commercialPolicyVersion`) → `remember` (sesión y visitante con la intervención sólo si el
      ledger la aceptó); quitar las reglas comerciales temporales de T009;
      `modules/decision.ts`, `ports.ts`, `profiles/local.ts`; `tests/unit/gateways/config-policy-directory.test.ts`;
      `tests/unit/application/decision/decision.service.test.ts` (orden de llamadas; `selection`
      en el ledger; CONTROL registra selección; incentivo sólo cuenta si el ledger aceptó;
      fatiga entre sesiones del mismo visitante)
- [x] T018 [US2] `tests/integration/commercial-policy.test.ts`: merchant con margen 40, techo
      10, escalones [5, 10] y `directIncentiveOnPrice` → barrera `price` ⇒ `INTERVENE` con
      `intervention.incentive { kind: "percent", value: 5 }` y `messageVersionId
msg_price_price_incentive_v0`; sin `marginPercent` ⇒ `msg_price_price_evidence_v0` sin
      `incentive`, y con stock/precio viejo ⇒ `NO_OP commercial-policy-blocked` (ledger
      `blocked.reason = "margin-missing"`); riesgo de devolución alto ⇒ sin incentivo;
      `evidenceProfile.returnsPolicy: false` + carrito → políticas ⇒
      `msg_returns_policies_information_v0` con el reaseguro `unacceptable: no-returns-policy` en
      el ledger; perfil vacío y barrera `returns` con sólo candidatos con claims ⇒
      `no-acceptable-candidate`; `cooldownSeconds: 600` ⇒ segunda intervención de la sesión
      `session-budget-exhausted` con presupuesto 2; `interventionsPerVisitorPerDay: 1` ⇒ segunda
      sesión del visitante `visitor-fatigue`; el DTO nunca lleva `candidates`, `claims`,
      `commercialVerdict` ni versiones
- [x] T019 [US2] SC-004: `tests/integration/decision-plane.test.ts`, `decision-evidence.test.ts`,
      `tests/unit/application/decision/decision.service.test.ts` y `isolation.test.ts` con los
      `messageVersionId` con escalón (`msg_fit_size_selector_information_v0`,
      `msg_returns_policies_reassurance_v0`) y ningún otro cambio de expectativa;
      `isolation.test.ts` + caso: política comercial de A (margen) vs B (sin margen) ⇒ incentivo
      sólo en A; fatiga del visitante en A no afecta a B
- [x] T020 [US2] Contrato y glosario: notas `docs/dominio/{incentivo,candidato,claim,quality-gate,
escalera-del-incentivo,politica-comercial,techo,margen,riesgo-de-devolucion,cooldown,fatiga}.md`
      (`incentivo` con `en: incentive`, usado por el contrato; el resto `uso: disponible`);
      `npm run contract:check`
- [x] T021 [US2] `npm run format:check && npm run quality && npm run typecheck && npm test &&
npm run contract:check && npm run test:mutation && npm run test:contract` en verde; commit
      `feat(commercial): política comercial por merchant, veredicto con escalera del incentivo y
las cinco autoridades del plano (ADR-027)`

---

## Phase 5: US3 — El abandono de carrito amplifica la barrera (Priority: P2)

- [x] T022 [US3] `tests/integration/commercial-policy.test.ts` (+): señales de `price` bajo el
      incentivo directo (`directIncentiveOnPrice: false`) y luego abandono ⇒ el escalón sube y
      sale el incentivo; señales de `fit` y abandono ⇒ de información a reaseguro sin
      `incentive`; abandono sin barrera ⇒ reaseguro de devoluciones sin `incentive`; el ledger
      lleva `trigger` y `chosen` coherentes
- [x] T023 [US3] Si T022 revela un orden distinto, corregir `CommercialPolicy.verdict` y la
      tabla de `verdict.test.ts` (`fix(commercial): …` sólo si hay cambios)

---

## Phase 6: US4 — Trazabilidad completa (Priority: P2)

- [x] T024 [US4] `tests/integration/commercial-policy.test.ts` (+): tras una decisión con tres
      candidatos (dos rechazados, uno elegido) el ledger lista los tres con veredicto y motivo y
      `chosen` es el tercero; con bloqueo, `commercialVerdict = { blocked: true, reason }` y
      `chosen` el candidato bloqueado; sin barrera, `selection.candidates = []`;
      `JSON.stringify(body)` no contiene `candidates|claims|commercialVerdict|PolicyVersion`

---

## Phase 7: Polish & documentación

- [x] T025 [P] `docs/adr/027-seleccion-quality-gate-y-politica-comercial.md` → `aceptada`;
      `docs/adr/026-politica-de-decision-por-merchant.md`: nota en §4 de que la 012 separó la
      política comercial (cita ADR-027); `npm run check:adrs`
- [x] T026 [P] `CLAUDE.md`: módulos `selection` y `commercial` en la lista; la nota "Plano de
      decisión" con las cinco autoridades, `commercialPolicy`/`evidenceProfile`, `incentive` en el
      DTO, estado por visitante; `README.md`: `commercialPolicy` y `evidenceProfile` en
      `OPE_MERCHANTS` con enlace a `contracts/commercial-policy.config.md`
- [x] T027 `npm run release-check` (el PROPUESTO del cupón queda como marcador del contrato,
      no bloqueante); `quickstart.md` con la tabla histórica de cierre; commit `chore(012):
ADR-027 aceptada, guía de agentes y cierre de la feature`

---

## Dependencies

- Phase 2: T002–T007 en paralelo → T008 → T009 → T010.
- Phase 3: T011 ∥ T012 (T012 usa los tipos de T011: escribir `candidate.ts` primero o en el
  mismo paso) → T013.
- Phase 4: T014 → T015 (necesita T002, T011, T012) → T016 → T017 → T018 ∥ T019 → T020 → T021.
- Phases 5–6 después de T021; Phase 7 al final (T025 ∥ T026).

## Implementation Strategy

1. **Fundacional** (commit 1): todo lo que cambia forma sin cambiar comportamiento; la suite
   de la 011 sigue verde con las mismas expectativas.
2. **Selección** (commit 2): dominio puro, probado por tabla, sin cablear.
3. **MVP = US2 (+ US3 + US4 por integración)** (commit 3): política comercial, configuración,
   orquestador con las cinco autoridades, integración y aislamiento; las pruebas de la 011 sólo
   cambian los `messageVersionId`.
4. **Cierre** (commit 4): ADR-027, guía de agentes, quickstart.
