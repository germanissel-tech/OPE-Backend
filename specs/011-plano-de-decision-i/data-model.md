# Data model — Feature 011: plano de decisión I

Fuente de las reglas: [spec.md](spec.md) (FR-010…FR-050) y [research.md](research.md)
(R-03…R-07). Clases donde hay invariantes o comportamiento; tipos donde no (ADR-024).

## Shared kernel (`src/domain/shared-kernel/`)

| Elemento               | Forma                                                                                                                       | Notas                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `BARRIERS` / `Barrier` | `["fit", "price", "returns"] as const`                                                                                      | 03 §4.2 DECIDIDO; compartido por `barrier`, `decision`, `ledger`          |
| `ANCHORS` / `Anchor`   | `["size_selector", "price", "cta", "policies"]` (desde `ledger`, cierra PROPUESTO ADR-024)                                  | réplica de `Anchor.yaml`; `tests/unit/anchors.test.ts` importa del kernel |
| `Intervention`         | `{ messageVersionId: string; anchor: Anchor }` (desde `ledger`)                                                             | sin reglas: tipo                                                          |
| `NO_OP_REASONS`        | + `barrier-unclear`, `evidence-missing`, `evidence-stale`, `variant-unavailable`, `high-intent`, `session-budget-exhausted` | réplica de `contracts/no-op-reasons.yaml`                                 |

## Módulo `ingestion` (cambios)

| Elemento                                                                                          | Cambio                                                                                                                                  |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `EVENT_TYPES`, `BLOCKS`, `PHOTO_INTERACTIONS`, `CTA_APPROACHES`, `CHECKOUT_STEPS`, `EXIT_SIGNALS` | listas `as const` en `event.ts` (los tipos se derivan de ellas); prueba de réplica contra los `enum` del contrato                       |
| `EventBatch`                                                                                      | `noOpReason()` desaparece; gana `focus(): { productId?: string; variantId?: string } \| undefined` (último evento de ficha de producto) |
| `DecisionPlane` (puerto, `application/ingestion/ports/decision-plane.ts`)                         | `decide(request: { merchantId; batch: EventBatch; now: Date }): Promise<Decision>`                                                      |
| `IngestBatchDependencies`                                                                         | `{ clock; eventDedup; decisionPlane }`                                                                                                  |

## Módulo `barrier` (nuevo; `domain/barrier/`, `application/barrier/`)

### `Signals` (clase, valor; `domain/barrier/signals.ts`)

- `EventKey = EventType | "<type>:<subtype>"` (R-03). `EventRef = { type: EventType; subtype?: string }`.
- Campos: `counts: ReadonlyMap<EventKey, number>`, `dwellMs: ReadonlyMap<Block, number>`,
  `firstAt: ReadonlyMap<EventKey, number>`, `lastAt: ReadonlyMap<EventKey, number>`.
- `static empty()`, `static of(events: readonly Event[])` (un evento con subtipo cuenta por su
  tipo **y** por `tipo:subtipo`), `merge(other): Signals` (conteos y permanencias suman;
  `firstAt` mínimo, `lastAt` máximo), `count(ref)`, `dwellSeconds(block)`, `sequence(a, b)`
  (`firstAt(a) < lastAt(b)`; falso si falta alguno), `rehydrate(record)` para el store.
- Sin invariantes de creación (toda secuencia de eventos válidos produce señales válidas).

### `Condition` (tipo discriminado, dato; `domain/barrier/condition.ts`)

```text
Condition =
  | { all: Condition[] } | { any: Condition[] } | { not: Condition }
  | { fact: "eventCount"; type: EventType; subtype?: string; min: number }
  | { fact: "dwellSeconds"; block: Block; min?: number }        // min ausente ⇒ readingSeconds
  | { fact: "sequence"; first: EventRef; then: EventRef }
  | { fact: "returnedToProduct" }
  | { fact: "productAttribute"; key: string; value: string }
  | { fact: "variantAvailable" }
  | { fact: "sessionAddedToCart" }
  | { fact: "sessionEnteredCheckout" }
```

`all([])` es verdadero; `any([])` es falso (identidades del álgebra; probado por tabla).

### `ProductFacts` (tipo; entrada de los predicados de producto)

`{ attributes: ReadonlyMap<string, string>; available?: boolean }` — derivado de la verdad de
producto por el orquestador; `available` ausente cuando no hay variante en foco (el predicado
`variantAvailable` es falso).

### `BarrierRules` (aggregate; `domain/barrier/barrier-rules.ts`)

- Record: `{ rules: readonly Rule[]; weights: { strong: number; supporting: number };
readingSeconds: number }`, `Rule = { id: string; when: Condition; barrier: Barrier; strength:
"strong" | "supporting"; weight?: number }`.
- `static of(record) → Result<BarrierRules, BarrierError>`; invariantes, en orden, con
  `details.index` de la regla:
  | Invariante                                                                                                                                   | Error (`code`)                                                       |
  | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
  | `weights.*` y `weight` en 0–1; `readingSeconds` ≥ 0; `min` ≥ 0 entero                                                                        | `invalid-rule-weight` / `invalid-rule-threshold`                     |
  | `id` no vacío y único                                                                                                                        | `duplicate-rule-id`                                                  |
  | `barrier ∈ BARRIERS`                                                                                                                         | `unknown-barrier`                                                    |
  | toda referencia de `when` existe: `type ∈ EVENT_TYPES`, `subtype` ∈ subtipos de ese tipo (y sólo si el tipo tiene subtipo), `block ∈ BLOCKS` | `unknown-fact` (detalle `path`, p. ej. `rules[2].when.all[1].block`) |
  | al menos una regla por barrera                                                                                                               | `barrier-without-rules`                                              |
- `static rehydrate(record)`.
- `infer(signals: Signals, product: ProductFacts) → Inference`: evalúa cada regla
  (`evaluate(condition)` privado, recursivo); `confidences[b] = min(1, Σ weightOf(rule))` para
  las cumplidas; `matched` = ids cumplidos en orden de declaración. Pura.
- `weightOf(rule) = rule.weight ?? weights[rule.strength]`.

### `Inference` (tipo; salida de la autoridad)

`{ confidences: Readonly<Record<Barrier, number>>; matched: readonly string[] }`.

### Puerto `BarrierInference` (`application/barrier/ports/barrier-inference.ts`)

`infer(context: { rules: BarrierRules; signals: Signals; product: ProductFacts }):
Promise<Inference>`; implementación `RuleBasedBarrierInference` (`application/barrier/services/`)
que delega en `rules.infer`.

## Módulo `decision` (nuevo; `domain/decision/`, `application/decision/`)

### `DecisionPolicy` (aggregate; `domain/decision/decision-policy.ts`)

- Record: `{ version: string; rules: BarrierRules; threshold: number; priority: readonly
Barrier[]; highIntent: "from-cart" | "from-checkout" | "never"; abandonment: "nothing" |
"reassure-returns"; interventionsPerSession: number; evidence: { freshStockAndPrice: readonly
Barrier[]; availableVariant: readonly Barrier[] } }`.
- `static of(record) → Result<DecisionPolicy, DecisionError>`:
  | Invariante                                         | Error                      |
  | -------------------------------------------------- | -------------------------- |
  | `version` no vacía (trim)                          | `invalid-policy-version`   |
  | `threshold` en 0–1                                 | `invalid-policy-threshold` |
  | `priority` es una permutación exacta de `BARRIERS` | `invalid-policy-priority`  |
  | `interventionsPerSession` entero ≥ 1               | `invalid-session-budget`   |
  | `evidence.*` ⊆ `BARRIERS`                          | `invalid-policy-evidence`  |
- `static rehydrate(record)`.
- `anchorFor(barrier): Anchor` = `ANCHOR_BY_BARRIER`; `messageFor(barrier): string` =
  `msg_<barrier>_<anchor>_v0`.
- `verdict(input: VerdictInput) → Verdict` (puro; orden en R-04):
  `VerdictInput = { arm?: Arm; inference: Inference; abandoned: boolean; truth: TruthSummary;
focusHasVariant: boolean; interventionsSoFar: number; enteredCheckout: boolean; addedToCart:
boolean }`;
  `Verdict = { kind: "intervene"; barrier; confidence; trigger: "rules" | "abandonment";
intervention: Intervention } | { kind: "no-op"; reason: NoOpReason; barrier?: Barrier;
trigger: "rules" | "abandonment" | "none" }`.
  - dominante: mayor confianza ≥ `threshold`; empate ⇒ primera en `priority`.
  - abandono sin señal: `abandoned && ninguna ≥ threshold && abandonment === "reassure-returns"`
    ⇒ candidata `returns`, confianza `rules.weights.supporting`, `trigger: "abandonment"`.
  - alta intención: `from-checkout` ⇒ `enteredCheckout`; `from-cart` ⇒ `addedToCart ||
enteredCheckout`; `never` ⇒ nunca.

### `TruthSummary` (tipo; lo que el veredicto necesita de la verdad)

`{ kind: "known" | "known-product" | "absent" | "stale" | "unknown-product" | "unknown-variant";
stockAndPrice?: "fresh" | "stale"; available?: boolean }` — construido por el orquestador desde
`ProductTruth`.

### `DEFAULT_DECISION_POLICY` (constante del dominio `decision`)

`version: "default-1"`, `threshold: 0.6`, `weights { strong: 0.4, supporting: 0.2 }`,
`readingSeconds: 5`, `priority: ["returns", "fit", "price"]`, `highIntent: "from-checkout"`,
`abandonment: "reassure-returns"`, `interventionsPerSession: 1`, `evidence {
freshStockAndPrice: ["price"], availableVariant: ["fit"] }`, y las reglas de
[spec.md § Assumptions](spec.md#assumptions) con ids `fit.size-selector-twice`,
`fit.size-guide-read`, `fit.variants-compared`, `fit.photo-zoomed` (apoyo),
`fit.returned-to-product` (apoyo), `price.cart-removed-without-reading`, `price.price-read`,
`price.returned-and-price-read`, `price.cta-approached` (apoyo), `price.checkout-then-exit`
(apoyo), `returns.policies-read`, `returns.cart-then-policies`,
`returns.size-doubt-and-policies`, `returns.photos-and-description` (apoyo),
`returns.policies-then-cart-removed` (apoyo). Construida con `DecisionPolicy.of` y verificada
por prueba (una constante inválida es un error de programación → `throw` al cargar el módulo).

### `SessionState` (clase; `domain/decision/session-state.ts`)

- Campos: `signals: Signals`, `interventions: number`, `updatedAt: Date`.
- `static empty(now)`, `static rehydrate(record)`, `absorb(batch: Signals, now) →
SessionState`, `withIntervention(now) → SessionState`; consultas `addedToCart()`,
  `enteredCheckout()`, `abandoned()` (= `signals.sequence(added_to_cart, removed_from_cart)`).

### Errores (`domain/decision/errors.ts`, `domain/barrier/errors.ts`)

Todos `DomainError` con `module = "decision"` / `"barrier"`, en `contracts/problem-types.yaml`
(errores de configuración: nunca por HTTP, como `invalid-treatment-share`); `config.ts` los
traduce a `ConfigError` con `FIELD_BY_CODE` (`.decisionPolicy.version`, `.threshold`,
`.priority`, `.interventionsPerSession`, `.evidence`, `.rules[<index>]` + `path`).

### Puertos (`application/decision/ports/`)

| Puerto                    | Firma                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DecisionPolicyDirectory` | `policyFor(merchantId): Promise<DecisionPolicy>` (la del merchant o la por defecto)                                                              |
| `SessionStateStore`       | `load(merchantId, sessionId): Promise<SessionState \| undefined>`; `save(merchantId, sessionId, state): Promise<void>`; ventana `SESSION_WINDOW` |

### `DecisionService` (`application/decision/services/decision.service.ts`)

- `implements DecisionPlane` (puerto de `ingestion`).
- `DecisionServiceDependencies = { assignment: AssignmentService; policies:
DecisionPolicyDirectory; sessions: SessionStateStore; inference: BarrierInference; truth:
ProductTruthService; recorder: DecisionRecorder }` (6).
- `decide({ merchantId, batch, now })`:
  1. `assignment.assign` → si falla, `NO_OP ledger-unavailable` (sin registrar, sin estado).
  2. `policy = policies.policyFor`; `state = (sessions.load ?? empty).absorb(Signals.of(batch.events))`.
  3. `focus = batch.focus()`; sin `productId` en ficha ⇒ veredicto `page-context-incomplete`
     (sin inferencia, `inference` ausente) → paso 6.
  4. `truth = focus.variantId ? truth.lookup(...) : truth.product(...)`; `product: ProductFacts`.
  5. `inference = inference.infer({ rules: policy.rules, signals: state.signals, product })`;
     `verdict = policy.verdict({...})`.
  6. `recorder.record(facts, verdict → outcome, inference-record)`; si `unavailable` ⇒ log +
     `NO_OP ledger-unavailable` y `sessions.save(state)` **sin** contar; si `intervene` ⇒
     `sessions.save(state.withIntervention())`; si no ⇒ `sessions.save(state)`.

## Módulo `ledger` (cambios)

| Elemento                                                      | Cambio                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DecisionFacts.inference?: DecisionInference`                 | `{ policyVersion: string; confidences: Readonly<Record<Barrier, number>>; matched: readonly string[]; barrier?: Barrier; trigger: "rules" \| "abandonment" \| "none"; evidence: { truth: TruthSummary["kind"] \| "not-consulted"; stockAndPrice?: "fresh" \| "stale"; available?: boolean } }` |
| `DecisionRecord`                                              | lo hereda (`rehydrate` lo conserva tal cual)                                                                                                                                                                                                                                                   |
| `DecisionRecorder` (servicio, `application/ledger/services/`) | `record(facts: Omit<DecisionFacts, "decisionId">, outcome: { kind: "no-op"; reason } \| { kind: "intervene"; reason; intervention }): Promise<Result<Decision, LedgerUnavailable>>`; deps `{ decisions: DecisionLedger; decisionIds: DecisionIdGenerator }`                                    |
| `ANCHORS`, `Anchor`, `Intervention`                           | se van al kernel; `ledger/index.ts` deja de exportarlos                                                                                                                                                                                                                                        |

## Módulo `catalog` (cambio)

`ProductTruthService.product(merchantId, productId): Promise<ProductTruth>` — misma frescura,
sin variante: `{ kind: "known-product", product, freshness: { catalog: "fresh", stockAndPrice }, ageMs }`
| `unknown { absent | stale | unknown-product }`. `ProductTruth` gana la rama `known-product`.

## Configuración (`OPE_MERCHANTS[i].decisionPolicy`, opcional)

Ver [contracts/decision-policy.config.md](contracts/decision-policy.config.md). Forma en
`config.ts` (`parseDecisionPolicy`): tipos primitivos y listas; todo lo demás (vocabulario,
rangos, permutación) lo decide `BarrierRules.of` / `DecisionPolicy.of`.

## Transiciones

`SessionState`: `∅ → absorb → (withIntervention)* → expira (24 h / 100 000 sesiones por merchant)`.
`Decision` (ledger): `ASSIGNED → DECIDED (NO_OP | INTERVENE con inference) → EXPOSED` sin cambios
de máquina; sólo `INTERVENE` puede pasar a `EXPOSED` (`exposure-of-no-op` ya existe).
