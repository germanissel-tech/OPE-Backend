# Data model — Feature 012: plano de decisión II

Fuente: [spec.md](spec.md) (FR-010…FR-053) y [research.md](research.md) (R-03…R-08).

## Shared kernel

| Elemento        | Cambio                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------ |
| `Intervention`  | `+ incentive?: Incentive`; `Incentive = { kind: "percent"; value: number }` (entero 1–100) |
| `NO_OP_REASONS` | `+ no-acceptable-candidate`, `commercial-policy-blocked`, `visitor-fatigue`                |

## Módulo `selection` (nuevo, sólo dominio; `src/domain/selection/`)

### Vocabulario (`candidate.ts`)

- `STEPS = ["information", "reassurance", "uncertainty", "evidence", "incentive"] as const`,
  `Step`.
- `Claim = "returns-policy" | "fit-data" | "current-price" | "availability" | "incentive" |
\`product-attribute:${string}\``; `ATTRIBUTE_CLAIM_PREFIX = "product-attribute:"`.
- `Candidate { candidateId: string; barrier: Barrier; step: Step; anchor: Anchor; claims:
readonly Claim[] }`.
- `CANDIDATES: Readonly<Record<Barrier, readonly Candidate[]>>`, ordenados por `STEPS`
  (R-03); prueba: ids únicos, cada lista ordenada por escalón, `barrier` coincide con la clave,
  ningún claim `incentive` fuera de `price`.

### `MerchantProfile` (`profile.ts`, tipo)

`{ returnsPolicy: boolean; fitData: boolean; authorizedAttributes: readonly string[] }`;
`EMPTY_PROFILE` = todo falso / vacío.

### `GateEvidence` (`quality-gate.ts`, tipo)

`{ attributes: ReadonlyMap<string, string>; stockAndPriceFresh: boolean; available?: boolean }`
(`available` ausente = sin variante en foco).

### `QualityGate` (`quality-gate.ts`, clase con `static judge`)

- `judge(candidate, evidence, profile) → GateVerdict = { acceptable: true } | { acceptable:
false; reason: GateRejection }`, `GateRejection = "no-returns-policy" | "no-fit-data" |
"stale-price" | "variant-unavailable" | "attribute-unknown" | "attribute-not-authorized"`.
- Evalúa los claims en orden y devuelve el primer rechazo (R-04). Pura.
- `judgeAll(candidates, evidence, profile) → readonly Judged[]`, `Judged = { candidate;
verdict }` en el orden de la escalera.

## Módulo `commercial` (nuevo, sólo dominio; `src/domain/commercial/`)

### `CommercialPolicy` (aggregate; `commercial-policy.ts`)

- Record: `{ version; maxIncentivePercent; incentiveLadderPercent: readonly number[];
marginPercent?: number; directIncentiveOnPrice: boolean; returnRisk: Condition; highIntent:
HighIntent; abandonment: Abandonment; interventionsPerSession; cooldownSeconds;
interventionsPerVisitorPerDay }` (`HighIntent`/`Abandonment` se mudan aquí desde `decision`).
- `of(record) → Result<CommercialPolicy, CommercialError>`:
  | Invariante                                                                       | `code`                                         |
  | -------------------------------------------------------------------------------- | ---------------------------------------------- |
  | `version` no blanca                                                              | `invalid-commercial-version`                   |
  | `maxIncentivePercent` entero 0–100                                               | `invalid-incentive-ceiling`                    |
  | escalones enteros, estrictamente crecientes, cada uno 1..techo                   | `invalid-incentive-ladder` (`details.index`)   |
  | `marginPercent` ausente o 0–100                                                  | `invalid-margin`                               |
  | `returnRisk` dentro del vocabulario                                              | `invalid-return-risk` (`details.path`)         |
  | `interventionsPerSession` entero ≥ 1, `interventionsPerVisitorPerDay` entero ≥ 1 | `invalid-intervention-budget` (`details.path`) |
  | `cooldownSeconds` ≥ 0                                                            | `invalid-cooldown`                             |
- `rehydrate(record)`.
- `fallbackBarrier(barrier: Barrier | undefined, abandoned: boolean) → Barrier | undefined`.
- `verdict(input: CommercialInput) → CommercialVerdict` (orden en R-05):
  `CommercialInput = { arm?: Arm; barrier?: Barrier; trigger: Trigger; evidenceReason?:
NoOpReason; judged: readonly Judged[]; abandoned; addedToCart; enteredCheckout; facts:
FactContext; session: { interventions: number; lastInterventionAt?: Date }; visitorInterventions:
number; now: Date }`;
  `CommercialVerdict = { kind: "intervene"; candidateId; intervention: Intervention } | {
kind: "no-op"; reason: NoOpReason; chosen?: string; blocked?: { candidateId: string; reason:
BlockReason } }`, `BlockReason = "margin-missing" | "incentive-not-allowed" | "return-risk"`.
- `DEFAULT_COMMERCIAL_POLICY` (`default-commercial-policy.ts`, versión `commercial-default-1`,
  R-05).

## Módulo `decision` (cambios)

| Elemento                  | Cambio                                                                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `DecisionPolicy`          | pierde `highIntent`, `abandonment`, `interventionsPerSession`, `anchorFor`, `messageFor`; `verdict` → `barrierVerdict(input) → BarrierVerdict` |
| `BarrierVerdict`          | `{ barrier?: Barrier; confidence?: number; trigger: "rules" \| "none"; evidenceReason?: NoOpReason }` (evidencia por barrera como en 011)      |
| `SessionState`            | `+ lastInterventionAt?: Date` (`withIntervention(now)` lo fija)                                                                                |
| `VisitorState`            | nueva clase: `interventions: readonly Date[]`; `empty()`, `rehydrate`, `countSince(now, windowMs)`, `withIntervention(now, windowMs)`          |
| `DEFAULT_DECISION_POLICY` | sin los campos comerciales; versión sigue `default-1` (el comportamiento por defecto no cambia)                                                |

### Aplicación (`src/application/decision/`)

| Elemento            | Forma                                                                                                                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MerchantPolicies`  | `{ decision: DecisionPolicy; commercial: CommercialPolicy; profile: MerchantProfile }`                                                                                                                                                                                                          |
| `PolicyDirectory`   | `policiesFor(merchantId): Promise<MerchantPolicies>` (reemplaza a `DecisionPolicyDirectory`)                                                                                                                                                                                                    |
| `VisitorStateStore` | `load(merchantId, visitorId)`, `save(merchantId, visitorId, state)`; `VISITOR_WINDOW = { ttlMs: hours(24), maxVisitors: 100_000 }`                                                                                                                                                              |
| `StateService`      | `recall(merchantId, sessionId, visitorId, now) → { session, visitor }`; `remember(merchantId, sessionId, visitorId, { session, visitor })`                                                                                                                                                      |
| `DecisionService`   | deps `{ assignment, policies, state, inference, truth, recorder }`; orden: asignación → políticas → estado → foco → verdad → inferencia → `barrierVerdict` → `fallbackBarrier` → `judgeAll(CANDIDATES[barrier])` → `commercial.verdict` → `record` (con `inference` y `selection`) → `remember` |

## Módulo `ledger` (cambio)

`DecisionFacts.selection?: DecisionSelection = { candidates: readonly { candidateId: string;
step: string; verdict: "acceptable" | "unacceptable"; reason?: string }[]; chosen?: string;
commercialVerdict: { blocked: boolean; reason?: string }; commercialPolicyVersion: string }`.
Conservado por `rehydrate`; nunca en el DTO.

## Configuración (`OPE_MERCHANTS[i]`)

- `commercialPolicy?` (ver [contracts/commercial-policy.config.md](contracts/commercial-policy.config.md)).
- `evidenceProfile?: { returnsPolicy?: boolean; fitData?: boolean; authorizedAttributes?:
string[] }` → `MerchantProfile` (ausentes ⇒ falso / vacío).
- `MerchantConfig` gana `commercialPolicy?` y `evidenceProfile?`; `configPolicyDirectory`
  combina los tres con sus valores por defecto.

## Transiciones

- `VisitorState`: `∅ → withIntervention* → poda por ventana` (24 h).
- `SessionState`: igual que en 011 más `lastInterventionAt`.
- `Decision`: sin cambio de máquina; `INTERVENE` puede llevar `incentive`.
