# Tasks: Plano de decisión I — barrera y evidencia

**Input**: Design documents from `specs/011-plano-de-decision-i/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: la spec exige tablas de casos (SC-001), determinismo y pureza (SC-002), políticas
inválidas nombradas (SC-003), flujo completo y latencia (SC-004), aislamiento (SC-005) y
réplicas contra el contrato; las tareas de prueba están incluidas.

**Organization**: por historia; la fase fundacional refactoriza sin cambiar comportamiento
(kernel, listas runtime, ledger con inferencia, recorder, verdad por producto) y deja la suite
verde; US3 (la política) va antes que US1 en el orden de construcción porque la inferencia
evalúa una política; US1 y US2 comparten el orquestador; US4 cierra el flujo.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable · **[Story]**: US1 inferencia y decisión · US2 evidencia de producto ·
  US3 política por merchant · US4 cadena de evidencia de punta a punta

## Path Conventions

Proyecto único: `src/`, `tests/`, `contracts/`, `docs/`. Módulos nuevos `barrier` y `decision`
en `src/domain/<m>/`, `src/application/<m>/`, `src/interface-adapters/gateways/decision/`,
`src/composition/modules/<m>.ts`. Sin controllers nuevos.

---

## Phase 1: Setup

- [x] T001 Verificar el punto de partida (`npm run contract:check && npm run quality && npm test`
      en verde) y anotar la cantidad de pruebas en la sección histórica de
      `specs/011-plano-de-decision-i/quickstart.md`

---

## Phase 2: Foundational — kernel, vocabulario runtime, ledger con inferencia (sin cambio de comportamiento)

- [x] T002 [P] Kernel: crear `src/domain/shared-kernel/intervention.ts` con `ANCHORS`, `Anchor`,
      `Intervention` (movidos desde `src/domain/ledger/decision.ts`) y
      `src/domain/shared-kernel/barrier.ts` con `BARRIERS = ["fit", "price", "returns"] as const`
      y `Barrier`; exportar desde `src/domain/shared-kernel/index.ts`; `ledger/decision.ts`,
      `ledger/index.ts`, `src/application/ledger/use-cases/confirm-exposure.use-case.ts` y
      `src/interface-adapters/http/controllers/ingestion/ingest-events.ts` importan del kernel;
      `tests/unit/anchors.test.ts` importa del kernel (la réplica de barreras contra el
      contrato llega en T023, cuando exista la descripción); quitar el PROPUESTO del comentario
      en `ledger/decision.ts`
- [x] T003 [P] `src/domain/ingestion/event.ts`: listas `EVENT_TYPES`, `BLOCKS`,
      `PHOTO_INTERACTIONS`, `CTA_APPROACHES`, `CHECKOUT_STEPS`, `EXIT_SIGNALS` como `as const`
      con los tipos derivados (`EventType = (typeof EVENT_TYPES)[number]`, etc.) y
      `SUBTYPES: Readonly<Partial<Record<EventType, readonly string[]>>>` (`photo_interacted`,
      `block_dwelled`, `cta_approached`, `checkout_advanced`, `exit_signaled`); exportar desde
      `src/domain/ingestion/index.ts`; `tests/unit/event-vocabulary.test.ts` (réplica contra
      los `enum` de `contracts/components/schemas/{Event,BlockDwelled,PhotoInteracted,
CtaApproached,CheckoutAdvanced,ExitSignaled}.yaml` y el `mapping` del discriminador)
- [x] T004 [P] `src/domain/ingestion/event-batch.ts`: `focus(): { productId?: string;
variantId?: string } | undefined` (último evento con `page.pageType === "product"`; `undefined`
      sin ficha); `noOpReason()` **se conserva** hasta T019 (lo usa el caso de uso actual);
      `tests/unit/domain/ingestion/event-batch.test.ts` cubre `focus` (sin ficha, ficha sin
      producto, ficha con producto y variante, dos fichas → la última)
- [x] T005 [P] Ledger: `src/domain/ledger/decision.ts` gana `DecisionInference` y
      `DecisionFacts.inference?: DecisionInference` (`{ policyVersion: string; confidences:
Readonly<Record<Barrier, number>>; matched: readonly string[]; barrier?: Barrier; trigger:
"rules" | "abandonment" | "none"; evidence: { truth: "known" | "known-product" | "absent" |
"stale" | "unknown-product" | "unknown-variant" | "not-consulted"; stockAndPrice?: "fresh" |
"stale"; available?: boolean } }`), copiado en el constructor y conservado por `rehydrate`;
      nuevo servicio `src/application/ledger/services/decision-recorder.service.ts`
      (`DecisionRecorder { record(facts: Omit<DecisionFacts, "decisionId">, outcome:
DecisionOutcomeInput): Promise<Result<Decision, LedgerUnavailable>> }`,
      `DecisionOutcomeInput = { kind: "no-op"; reason: NoOpReason } | { kind: "intervene";
reason: string; intervention: Intervention }`, `DefaultDecisionRecorder` con deps
      `{ decisions: DecisionLedger; decisionIds: DecisionIdGenerator }`); exportar por el índice;
      `tests/unit/domain/ledger/decision.test.ts` (+ `inference` en `rehydrate`) y
      `tests/unit/application/ledger/decision-recorder.service.test.ts` (acuña id, registra,
      `LedgerUnavailable` con `tests/helpers/unavailable-ledgers.ts`)
- [x] T006 [P] `src/application/catalog/services/product-truth.service.ts`: `ProductTruth`
      gana la rama `{ kind: "known-product"; product; freshness: { catalog: "fresh";
stockAndPrice }; ageMs }`; `product(merchantId, productId): Promise<ProductTruth>` (misma
      frescura; `unknown` con `absent | stale | unknown-product`); `tests/unit/application/catalog/product-truth.service.test.ts`
      (+ `product`: fresco, stale, ausente, producto desconocido)
- [x] T007 `npm run quality && npm test` en verde (`knip`: `DecisionRecorder` y `product` usados por
      pruebas y, hasta T019, por nadie en `src/` — si `check:dead-code` bloquea, cablear el
      recorder en `modules/ledger.ts` como `decisionRecorderOf(ports)` ya en esta fase); commit
      `refactor(kernel): vocabularios de barrera e intervención en el kernel, listas runtime de
eventos, inferencia en la decisión del ledger y verdad por producto`

---

## Phase 3: US3 — Política por merchant, versionada y validada (Priority: P1)

**Goal**: reglas de barrera y política de decisión como aggregates validados por construcción,
con la política por defecto y su carga desde `OPE_MERCHANTS`.

**Independent Test**: `BarrierRules.of` / `DecisionPolicy.of` rechazan ≥ 8 casos inválidos
nombrando el campo; `DEFAULT_DECISION_POLICY` es válida con los valores del stakeholder; una
`decisionPolicy` inválida en `OPE_MERCHANTS` impide el arranque con `ConfigError` que cita
`merchants[i].decisionPolicy…`.

- [x] T008 [P] [US3] Dominio `src/domain/barrier/`: `signals.ts` (`EventKey`, `EventRef`,
      `class Signals { static empty(); static of(events); static rehydrate(record); merge(other);
count(ref); dwellSeconds(block); sequence(first, then); toRecord() }` — un evento con subtipo
      cuenta por tipo y por `tipo:subtipo`; `firstAt`/`lastAt` por clave; `dwellMs` por bloque),
      `condition.ts` (`Condition` discriminada, `ProductFacts`), `errors.ts` (`InvalidRuleWeight`,
      `InvalidRuleThreshold`, `DuplicateRuleId`, `UnknownBarrier`, `UnknownFact` con
      `details: { index, path }`, `BarrierWithoutRules`; `module = "barrier"`; unión
      `BarrierError`), `barrier-rules.ts` (`Rule`, `BarrierRulesRecord`, `Inference`,
      `class BarrierRules { static of → Result; static rehydrate; infer(signals, product):
Inference; weightOf(rule) }` con la evaluación recursiva privada de `Condition`), `index.ts`;
      `CONTEXT_MAP.barrier = ["shared-kernel", "ingestion"]`; los 6 códigos en
      `contracts/problem-types.yaml` (500) y `PROBLEM_TYPES`;
      `tests/unit/domain/barrier/condition.test.ts` (tabla: cada predicado verdadero/falso,
      `all([])`, `any([])`, `not`, anidamiento de 3 niveles, `dwellSeconds` sin `min` usa
      `readingSeconds`), `tests/unit/domain/barrier/signals.test.ts` (monoide: identidad,
      asociatividad; `sequence` exacta; `rehydrate(toRecord())` idéntico),
      `tests/unit/domain/barrier/barrier-rules.test.ts` (≥ 8 casos inválidos con `code`,
      `index` y `path`; `infer`: confianza acotada a 1, `matched` en orden de declaración,
      `weight` explícito, determinismo en 1 000 evaluaciones)
- [x] T009 [P] [US3] Dominio `src/domain/decision/`: `errors.ts` (`InvalidPolicyVersion`,
      `InvalidPolicyThreshold`, `InvalidPolicyPriority`, `InvalidSessionBudget`,
      `InvalidPolicyEvidence`; `module = "decision"`; unión `DecisionError`),
      `decision-policy.ts` (`DecisionPolicyRecord`, `HighIntent`, `Abandonment`,
      `EvidenceRequirements`, `ANCHOR_BY_BARRIER`, `class DecisionPolicy { static of → Result;
static rehydrate; version; rules; anchorFor(barrier); messageFor(barrier) }` — `verdict` llega
      en T013), `index.ts`; `CONTEXT_MAP.decision = ["shared-kernel", "ledger", "experiment",
"ingestion", "catalog", "barrier"]`; los 5 códigos en `contracts/problem-types.yaml` y
      `PROBLEM_TYPES`; `tests/unit/domain/decision/decision-policy.test.ts` (cada invariante;
      `anchorFor`/`messageFor` → `msg_fit_size_selector_v0`, `msg_price_price_v0`,
      `msg_returns_policies_v0`)
- [x] T010 [US3] `src/domain/decision/default-policy.ts`: `DEFAULT_DECISION_POLICY` construida
      con `DecisionPolicy.of` (versión `default-1`, umbral 0,6, pesos 0,4 / 0,2, 5 s, prioridad
      `returns → fit → price`, `from-checkout`, `reassure-returns`, 1 por sesión, evidencia
      `{ freshStockAndPrice: ["price"], availableVariant: ["fit"] }`) y las 15 reglas de
      `spec.md § Assumptions` con los ids de `data-model.md`; `throw` si la fábrica falla;
      `tests/unit/domain/decision/default-policy.test.ts` (valores del stakeholder; cada id
      presente con su barrera y fuerza)
- [x] T011 [US3] `src/composition/config.ts`: `MerchantConfig.decisionPolicy?: DecisionPolicy`;
      `parseDecisionPolicy(raw, at)` (forma: `version` string, `threshold` number,
      `readingSeconds` number default 5, `weights` `{ strong, supporting }` default 0,4 / 0,2,
      `priority` string[], `highIntent` y `abandonment` en sus uniones, `interventionsPerSession`
      number, `evidence` `{ freshStockAndPrice: string[]; availableVariant: string[] }`,
      `rules[]` con `id`, `barrier`, `strength`, `weight?`, `when` recursivo con claves
      permitidas `all | any | not | fact`) → `BarrierRules.of` → `DecisionPolicy.of`;
      `FIELD_BY_CODE` con los 11 códigos (`.decisionPolicy.version`, `.threshold`,
      `.priority`, `.interventionsPerSession`, `.evidence`, `.rules[<index>]` + `details.path`);
      `tests/unit/composition/config.test.ts` (política válida; sin política → `undefined`;
      ≥ 6 rechazos con el campo exacto, entre ellos `merchants[0].decisionPolicy.rules[1].when.all[0].block`)
- [x] T012 [US3] Puerto y gateway: `src/application/decision/ports/decision-policy-directory.ts`
      (`DecisionPolicyDirectory { policyFor(merchantId): Promise<DecisionPolicy> }`),
      `src/interface-adapters/gateways/decision/config-decision-policy-directory.ts`
      (`configDecisionPolicyDirectory(entries: { merchantId; policy?: DecisionPolicy }[])` →
      la del merchant o `DEFAULT_DECISION_POLICY`); `tests/unit/gateways/config-decision-policy-directory.test.ts`;
      `tests/helpers/test-app.ts`: `MerchantSpec.decisionPolicy?` (record crudo → `parse` o
      `DecisionPolicy.of`) para que las pruebas de integración configuren A y B distintos

---

## Phase 4: US1 — Inferencia con la política del merchant y decisión (Priority: P1)

**Goal**: el veredicto puro, el estado de sesión, la inferencia por reglas y el orquestador
`DecisionService` que implementa el puerto `DecisionPlane` de la ingesta; primera `INTERVENE`.

**Independent Test**: tabla de la historia 1 sobre `DecisionPolicy.verdict`; integración:
dos `size_selector_interacted` + guía de talles 6 s → `INTERVENE size_selector`; una señal →
`barrier-unclear`; checkout → `high-intent`; segunda intervención → `session-budget-exhausted`;
CONTROL → `control-arm` con inferencia en el ledger.

- [x] T013 [US1] `src/domain/decision/decision-policy.ts`: `VerdictInput`, `Verdict`,
      `TruthSummary` y `verdict(input)` puro en el orden de R-04 (experimento ausente → CONTROL →
      alta intención → presupuesto → dominante por umbral y prioridad, o abandono sin señal con
      confianza `weights.supporting` → evidencia: `absent | unknown-*` ⇒ `evidence-missing`;
      `stale` o `stockAndPrice: "stale"` cuando la barrera está en `freshStockAndPrice` ⇒
      `evidence-stale`; `available === false` cuando está en `availableVariant` ⇒
      `variant-unavailable`; sin variante en foco cuando está en `availableVariant` ⇒
      `evidence-missing` → `intervene` con `intervention` de `anchorFor`/`messageFor`);
      `NO_OP_REASONS` gana los 6 motivos en `src/domain/shared-kernel/no-op-reasons.ts`
      **junto con** `contracts/no-op-reasons.yaml` (réplica `tests/unit/no-op-reasons.test.ts`);
      `tests/unit/domain/decision/verdict.test.ts`: tabla con los 8 escenarios de la historia 1
      y los 6 de la historia 2, más empate por prioridad y `never`/`from-cart`
- [x] T014 [P] [US1] `src/domain/decision/session-state.ts`: `class SessionState { static
empty(now); static rehydrate(record); absorb(signals, now); withIntervention(now);
addedToCart(); enteredCheckout(); abandoned(); signals; interventions; updatedAt; toRecord() }`;
      `tests/unit/domain/decision/session-state.test.ts`
- [x] T015 [P] [US1] Aplicación `barrier`: `src/application/barrier/ports/barrier-inference.ts`
      (`BarrierInference { infer(context: { rules: BarrierRules; signals: Signals; product:
ProductFacts }): Promise<Inference> }`), `src/application/barrier/services/rule-based-inference.service.ts`
      (`RuleBasedBarrierInference implements BarrierInference` → `rules.infer`), `index.ts`;
      `tests/unit/application/barrier/rule-based-inference.service.test.ts`
- [x] T016 [P] [US1] Puerto y gateway de sesión: `src/application/decision/ports/session-state-store.ts`
      (`SessionStateStore { load(merchantId, sessionId); save(merchantId, sessionId, state) }`),
      `src/application/decision/policies/session-window.ts` (`SESSION_WINDOW = { ttlMs:
hours(24), maxSessions: 100_000 }`), `src/interface-adapters/gateways/decision/memory-session-state-store.ts`
      (`memorySessionStateStore(clock, window)`: `Map` por merchant con orden de inserción,
      expiración perezosa por `updatedAt`, tope de sesiones); `tests/unit/gateways/memory-session-state-store.test.ts`
      (aislamiento por merchant, expiración, tope)
- [x] T017 [US1] Puerto de la ingesta: `src/application/ingestion/ports/decision-plane.ts`
      (`DecisionRequest { merchantId; batch: EventBatch; now: Date }`, `DecisionPlane {
decide(request): Promise<Decision> }`); exportar por el índice de `ingestion`
- [x] T018 [US1] Orquestador `src/application/decision/services/decision.service.ts`:
      `DecisionService implements DecisionPlane` con deps `{ assignment: AssignmentService;
policies: DecisionPolicyDirectory; sessions: SessionStateStore; inference: BarrierInference;
truth: ProductTruthService; recorder: DecisionRecorder }` (+ `logger` sólo si cabe en 6; si
      no, la degradación loguea vía `recorder`), `decide` en el orden del plan (asignación
      fallida ⇒ `NO_OP ledger-unavailable` sin registrar; `page-context-incomplete` sin
      inferencia; verdad por `lookup`/`product`; `ProductFacts` y `TruthSummary` desde
      `ProductTruth`; `inference.infer`; `policy.verdict`; `recorder.record` con `inference`
      en los facts; `sessions.save` contando la intervención sólo si el ledger la aceptó);
      `index.ts` de `application/decision`; `tests/unit/application/decision/decision.service.test.ts`
      (orden de llamadas con dobles; CONTROL registra la inferencia; ledger caído no cuenta la
      intervención y responde `ledger-unavailable`; estado de sesión acumulado entre lotes;
      `arch`: `services-no-use-cases`, sin ciclo)
- [x] T019 [US1] Ingesta: `src/application/ingestion/use-cases/ingest-batch.use-case.ts` con
      deps `{ clock; eventDedup; decisionPlane }` (`EventBatch.of` → `claim` →
      `decisionPlane.decide({ merchantId, batch, now })` → respuesta); eliminar
      `EventBatch.noOpReason()` y `reasonFor`; `tests/unit/application/ingestion/ingest-batch.use-case.test.ts`
      con un `DecisionPlane` doble
- [x] T020 [US1] Composición: `src/composition/modules/barrier.ts` (`BarrierPorts { inference:
BarrierInference }`, `ruleBarrierPorts`), `src/composition/modules/decision.ts`
      (`DecisionPorts extends ExperimentPorts, CatalogPorts, Pick<LedgerPorts, …> { policies;
sessions; inference; decisions; decisionIds }`, `configDecisionPorts(merchants)`,
      `memoryDecisionPorts(clock)`, `decisionPlaneOf(ports): DecisionPlane` con
      `assignmentServiceOf`, `productTruthOf`, `DefaultDecisionRecorder`, `DecisionService`,
      `decisionModule` sin handlers), `modules/ingestion.ts` (`IngestionPorts` deja de extender
      `ExperimentPorts`; recibe `decisionPlane` construido por `decisionPlaneOf(ports)` — el
      módulo de ingesta importa de `modules/decision.js` como hoy importa de `experiment.js`),
      `modules/index.ts` (`MODULES` + `barrierModule`, `decisionModule`), `ports.ts`,
      `profiles/local.ts` (`ruleBarrierPorts`, `configDecisionPorts(config.merchants)`,
      `memoryDecisionPorts(kernel.clock)`); `tests/helpers/test-app.ts` expone
      `app.ports.sessions` y `app.ports.policies`
- [x] T021 [US1] `tests/integration/decision-plane.test.ts` (merchant con `treatmentPercent:
100` vía `MerchantSpec`; catálogo fresco con `putCatalog`): escenarios 1, 2, 3, 4, 5, 7 y 8 de
      la historia 1 con el motivo/anclaje exacto; CONTROL (`treatmentPercent: 0`) → `control-arm`
      y la decisión en `app.ports.decisions` lleva `inference.barrier`; el DTO no tiene
      `barrier`, `confidence` ni `signals` (FR-040); `tests/integration/ingest-latency.test.ts`
      gana un caso con señales y catálogo (umbral intacto)
- [x] T022 [US1] `tests/integration/isolation.test.ts`: A con umbral 0,9 y B con 0,4 → la
      misma sesión decide `barrier-unclear` en A e `INTERVENE` en B; el mismo `sessionId` en A
      y B no comparte presupuesto ni señales; `policyVersion` de cada uno en su ledger
- [x] T023 [US1] Contrato y glosario: `contracts/no-op-reasons.yaml` (+ 6, de
      `contracts/no-op-reasons.additions.yaml`, si no entró en T013),
      `contracts/components/schemas/Decision.yaml` e `Intervention.yaml` (descripciones de
      `contracts/decision-description.yaml`, sin PROPUESTO), notas `docs/dominio/{barrera,senal,
evidencia,confianza,politica-de-decision,intencion}.md` (frontmatter `es/en/contexto/estado/
fuente`; `barrera` con `en: barrier`), `tests/unit/barriers.test.ts` amplía la réplica a la
      descripción de `Decision.outcome`; `npm run contract:check` (diff compatible, glosario,
      marcadores) y `npm run contract:types` (sin drift esperado)
- [x] T024 [US1] `npm run format:check && npm run quality && npm run typecheck && npm test &&
npm run contract:check && npm run test:contract` en verde; commit `feat(decision): plano de
decisión I — inferencia de barrera por reglas del merchant, evidencia de producto y primera
intervención (ADR-026)` (US3 + US1 + US2 en un commit: el servidor exige el plano completo
      para que la ingesta responda)

---

## Phase 5: US2 — Evidencia de producto (Priority: P1)

**Goal**: probar por integración que el plano se calla sin verdad suficiente.

**Independent Test**: catálogo ausente → `evidence-missing`; 3 días → `evidence-stale`;
variante no disponible con `fit` → `variant-unavailable`; stock viejo (2 h) con `returns` y
`fit` → `INTERVENE`, con `price` → `evidence-stale`; ficha sin producto →
`page-context-incomplete`; ficha sin variante → `fit` ⇒ `evidence-missing`, `returns` ⇒ decide.

- [x] T025 [US2] `tests/integration/decision-evidence.test.ts` con reloj controlado
      (`startTestApp` con `clock` reemplazable) y `putCatalog`: los 6 escenarios de la historia
      2; el ledger registra `inference.evidence` (`truth`, `stockAndPrice`, `available`)
- [x] T026 [US2] Si T025 revela un orden distinto en `verdict`, corregir en
      `src/domain/decision/decision-policy.ts` y en la tabla de `verdict.test.ts`; `npm test`
      en verde (sin commit propio si no hay cambios; si los hay, `fix(decision): …`)

---

## Phase 6: US4 — Cadena de evidencia de punta a punta (Priority: P2)

- [x] T027 [US4] `tests/integration/decision-plane.test.ts`: ingesta → `INTERVENE` →
      `POST /v1/exposures` con ese `decisionId` → `201 recorded` (ledger `ASSIGNED`, `DECIDED`
      con `inference`, `EXPOSED`); repetir → `200 already-recorded`; `NO_OP` → `422
exposure-of-no-op` (ya existe: verificar que sigue)
- [x] T028 [US4] `config/dev-merchants.json`: `treatmentPercent: 100` en el experimento de
      desarrollo (comentario en `README`/quickstart: en dev todo visitante es TREATMENT para
      probar a mano); `npm run dev` + escenario manual del quickstart con Insomnia (registrar el
      resultado en la sección histórica de `quickstart.md`)

---

## Phase 7: Polish & documentación

- [x] T029 [P] `docs/adr/026-politica-de-decision-por-merchant.md` (estado `aceptada`, fuente
      `specs/011-plano-de-decision-i/research.md`): política por merchant como reglas tipadas
      sobre vocabulario cerrado; motor propio en el dominio; dos módulos por constitución I;
      puerto `DecisionPlane` en la ingesta; la política es parte del experimento (versión
      estampada); veredicto en `decision` como semilla de la política comercial (012 decide si
      se separa); criterio de revisión (motor genérico cuando un merchant necesite hechos fuera
      del vocabulario o autoría desde el portal); **PROPUESTO** holdout al pasar a 100 %
      TREATMENT (pregunta al stakeholder); `docs/adr/README.md` índice; `npm run check:adrs`
- [x] T030 [P] `docs/adr/024-dominio-rico.md`: los dos PROPUESTO pasan a "Cerrado en 011"
      (`noOpReason()` → plano; `Anchor`/`Intervention` → kernel); `docs/adr/022-asignacion-experimental.md`:
      nota de que la política de decisión es parte del experimento (cita ADR-026);
      `npm run check:markers` sin los dos y con el del holdout
- [x] T031 [P] `CLAUDE.md`: módulos `barrier` y `decision` en la lista y en el mapa; nota
      operativa "Plano de decisión (ADR-026)" (puerto `DecisionPlane`, `DecisionPolicy` por
      merchant con `default-1`, `Signals` monoide, `inference` en el ledger, motivos nuevos,
      `SESSION_WINDOW`); `README.md` si describe `OPE_MERCHANTS` (campo `decisionPolicy` con
      enlace a `specs/011-plano-de-decision-i/contracts/decision-policy.config.md`)
- [x] T032 `npm run test:mutation` (matar supervivientes con pruebas dirigidas; `Stryker disable`
      sólo con motivo), `npm run release-check`, `npm run check:dead-code`; `quickstart.md` con
      la tabla histórica de cierre (fecha, pruebas, marcadores); commit `chore(011): ADR-026
aceptada, cierre de ADR-024, guía de agentes y cierre de la feature`

---

## Dependencies

- Phase 2 (T002–T007) antes de todo; T002–T006 en paralelo, T007 los cierra.
- Phase 3 (US3): T008 ∥ T009 → T010 → T011 → T012.
- Phase 4 (US1): T013 después de T009/T010; T014 ∥ T015 ∥ T016 después de T008; T017 libre;
  T018 después de T005, T006, T013–T017; T019 después de T017–T018; T020 después de T012,
  T018, T019; T021–T023 después de T020; T024 cierra.
- Phase 5 (US2) y Phase 6 (US4) después de T024; Phase 7 al final (T029–T031 en paralelo).

## Parallel Examples

- Fundacional: T002 (kernel), T003 (listas), T004 (`focus`), T005 (ledger), T006 (verdad)
  tocan archivos distintos.
- Dominio nuevo: T008 (`barrier`) y T009 (`decision`) en paralelo; luego T014, T015, T016.
- Documentación: T029, T030, T031.

## Implementation Strategy

1. **Fundacional** (commit 1): refactor sin cambio de comportamiento; suite verde.
2. **MVP = US3 + US1 + US2** (commit 2): política, inferencia, orquestador y evidencia entran
   juntos porque el servidor no arranca a medias (la ingesta necesita un plano que decida);
   las pruebas unitarias de cada pieza se escriben antes de cablear.
3. **US4 + cierre** (commit 3): flujo manual, ADR-026, cierre de marcadores, guía de agentes,
   mutación y release-check.
