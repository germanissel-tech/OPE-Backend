// The decision plane (01-arquitectura-mvp.md §4; constitution I; ADR-026, ADR-027): the
// orchestrator of the critical path for one batch. It builds the context and invokes the five
// authorities in a fixed order — assignment → barrier inference → product evidence → selection
// with the quality gate → commercial policy — and hands the decision to the ledger. It infers
// nothing and chooses nothing itself; only the commercial policy emits the verdict. Implements
// the port the ingestion declares (DecisionPlane), so the ingestion never depends on this module.
//
// Fail-closed at every step (constitution II): a page without a resolved product decides
// nothing about a product; an assignment the ledger could not record degrades to NO_OP
// `ledger-unavailable` (ADR-021); and only an intervention the ledger accepted counts against
// the session and visitor budgets — they measure what the visitor saw.
import { FactContext, Signals, type ProductFacts } from "../../../domain/barrier/index.js";
import { asProductId, asVariantId } from "../../../domain/catalog/index.js";
import type { CandidatesService } from "./candidates.service.js";
import type { StateService } from "./state.service.js";
import type { CommercialVerdict, Trigger } from "../../../domain/commercial/index.js";
import type { SessionState, TruthSummary } from "../../../domain/decision/index.js";
import type { ProductFocus } from "../../../domain/ingestion/index.js";
import type {
  Decision,
  DecisionInference,
  DecisionPhase,
  DecisionSelection,
  EvidenceRecord,
} from "../../../domain/ledger/index.js";
import type { GateEvidence, Judged } from "../../../domain/selection/index.js";
import type { Arm, Barrier, MerchantId, NoOpReason } from "../../../domain/shared-kernel/index.js";
import type { ProductTruth, ProductTruthService } from "../../catalog/index.js";
import type { AssignmentService } from "../../experiment/index.js";
import type { DecisionPlane, DecisionRequest } from "../../ingestion/index.js";
import type { DecisionFactsInput, DecisionOutcomeInput, DecisionRecorder } from "../../ledger/index.js";
import type { MerchantPolicies, PolicyDirectory } from "../ports/policy-directory.js";

export interface DecisionServiceDependencies {
  assignment: AssignmentService;
  policies: PolicyDirectory;
  state: StateService;
  candidates: CandidatesService;
  truth: ProductTruthService;
  recorder: DecisionRecorder;
}

const PAGE_CONTEXT_INCOMPLETE: NoOpReason = "page-context-incomplete";
const MERCHANT_OFF: NoOpReason = "merchant-off";
/** The phase a decision records while the experiment calibrates (03 §4.10). */
const CALIBRATION: DecisionPhase = "calibration";

/** The product truth of the focus as the authorities need it: facts for the rules, a summary for the barrier verdict, evidence for the gate, a record for the ledger. */
interface Evidence {
  product: ProductFacts;
  truth: TruthSummary;
  gate: GateEvidence;
  record: EvidenceRecord;
}

/** The context the orchestrator carries through the authorities of one batch. */
interface Context {
  merchantId: MerchantId;
  /**
   * Language of the page in focus, when the SDK read one: which text the catalogue can serve.
   * Optional **and** `undefined`, unlike the request of the messages plane: inside the orchestrator
   * an absent language and an undefined one are the same thing, so guarding the difference would be
   * a branch no test can tell apart. The one place it matters is the port, and it guards it there.
   */
  locale?: string | undefined;
  policies: MerchantPolicies;
  session: SessionState;
  visitorInterventions: number;
  arm?: Arm;
  evidence: Evidence;
  now: Date;
}

/** What the authorities settled on: the verdict, and how it was reasoned, for the ledger. */
interface Judgement {
  verdict: CommercialVerdict;
  inference: DecisionInference;
  selection: DecisionSelection;
}

export class DecisionService implements DecisionPlane {
  readonly #deps: DecisionServiceDependencies;

  constructor(deps: DecisionServiceDependencies) {
    this.#deps = deps;
  }

  async decide({ merchantId, batch, now }: DecisionRequest): Promise<Decision> {
    const { assignment, policies, state: memory, recorder } = this.#deps;
    const { sessionId, visitorId } = batch;
    const whose = { merchantId, sessionId, visitorId };
    // The versions the decision is taken with come first: every outcome stamps them (01 §14.2).
    const merchant = await policies.policiesFor(merchantId);
    const facts: DecisionFactsInput = { ...whose, decidedAt: now, configuration: merchant.versions };

    // The kill switch comes before the assignment: off, nothing is assigned, nothing is consumed.
    if (!merchant.enabled) return recorder.record(facts, { kind: "no-op", reason: MERCHANT_OFF });

    const assigned = await assignment.assign(merchantId, visitorId);
    if (!assigned.ok) return recorder.unrecorded(facts, "assignment not recorded");
    if (assigned.value) {
      const { assignment, phase } = assigned.value;
      facts.experiment = { experimentId: assignment.experimentId, arm: assignment.arm };
      if (phase === CALIBRATION) facts.phase = CALIBRATION;
    }

    const remembered = await memory.recall(whose, now);
    const session = remembered.session.absorb(Signals.of(batch.events), now);

    const focus = batch.focus();
    let outcome: DecisionOutcomeInput = { kind: "no-op", reason: PAGE_CONTEXT_INCOMPLETE };
    if (focus !== undefined) {
      if (focus.locale !== undefined) facts.locale = focus.locale;
      const arm = assigned.value?.assignment.arm;
      const judged = await this.#judge({
        merchantId,
        locale: focus.locale,
        policies: merchant,
        session,
        visitorInterventions: remembered.visitorInterventions,
        evidence: await this.#evidence(merchantId, focus),
        now,
        ...(arm === undefined ? {} : { arm }),
      });
      facts.inference = judged.inference;
      facts.selection = judged.selection;
      outcome = outcomeOf(judged.verdict);
    }

    const decision = await recorder.record(facts, outcome);
    await memory.remember(
      whose,
      decision.isIntervention()
        ? { session: session.withIntervention(now), intervention: { visitor: remembered.visitor, at: now } }
        : { session },
    );
    return decision;
  }

  /** Inference → barrier verdict → selection with the gate → commercial verdict; the ledger gets how it was reasoned. */
  async #judge({
    merchantId,
    locale,
    policies,
    session,
    visitorInterventions,
    arm,
    evidence,
    now,
  }: Context): Promise<Judgement> {
    const { commercial } = policies;
    const abandoned = session.abandoned();
    // The barrier the commercial policy settles on has to be known before asking what can be said,
    // because the candidates are the ones of that barrier. The inference itself is the service's.
    const { inference, settled, barrier, judged, unsustainable } = await this.#deps.candidates.for({
      merchantId,
      policies,
      signals: session.signals,
      product: evidence.product,
      truth: evidence.truth,
      evidence: evidence.gate,
      abandoned,
      locale,
      attributes: evidence.gate.attributes,
    });
    const trigger = triggerOf(settled.barrier, barrier);
    const verdict = commercial.verdict({
      arm,
      barrier,
      trigger,
      unsustainable,
      judged,
      abandoned,
      addedToCart: session.addedToCart(),
      enteredCheckout: session.enteredCheckout(),
      facts: FactContext.of({
        signals: session.signals,
        product: evidence.product,
        readingSeconds: policies.decision.rules.readingSeconds,
      }),
      session: {
        interventions: session.interventions,
        // Stryker disable next-line ConditionalExpression: an absent key and an undefined one are the same input
        ...(session.lastInterventionAt === undefined
          ? {}
          : { lastInterventionAt: session.lastInterventionAt }),
      },
      visitorInterventions,
      now,
    });
    return {
      verdict,
      inference: {
        policyVersion: policies.decision.version,
        confidences: inference.confidences,
        matched: inference.matched,
        trigger,
        evidence: evidence.record,
        ...(barrier === undefined ? {} : { barrier }),
      },
      selection: selectionOf(judged, verdict, commercial.version),
    };
  }

  async #evidence(merchantId: MerchantId, focus: ProductFocus): Promise<Evidence> {
    const { truth } = this.#deps;
    const productId = asProductId(focus.productId);
    const found =
      focus.variantId === undefined
        ? await truth.product(merchantId, productId)
        : await truth.lookup(merchantId, productId, asVariantId(focus.variantId));
    return evidenceOf(found);
  }
}

/** What put the barrier on the table: the rules, the abandonment fallback, or nothing. */
function triggerOf(inferred: Barrier | undefined, selected: Barrier | undefined): Trigger {
  if (inferred !== undefined) return "rules";
  return selected === undefined ? "none" : "abandonment";
}

/** The barrier of the chosen candidate is the reason of an INTERVENE (contract: Decision.reason). */
function outcomeOf(verdict: CommercialVerdict): DecisionOutcomeInput {
  return verdict.kind === "no-op"
    ? { kind: "no-op", reason: verdict.reason }
    : { kind: "intervene", reason: verdict.barrier, intervention: verdict.intervention };
}

function selectionOf(
  judged: readonly Judged[],
  verdict: CommercialVerdict,
  version: string,
): DecisionSelection {
  const candidates = judged.map(({ candidate, verdict: gate }) => ({
    candidateId: candidate.candidateId,
    step: candidate.step,
    verdict: gate.acceptable ? ("acceptable" as const) : ("unacceptable" as const),
    ...(gate.acceptable ? {} : { reason: gate.reason }),
  }));
  if (verdict.kind === "intervene") {
    return {
      candidates,
      chosen: verdict.candidateId,
      commercialVerdict: { blocked: false },
      commercialPolicyVersion: version,
    };
  }
  const chosen = verdict.blocked?.candidateId ?? verdict.chosen;
  const blocked = verdict.blocked;
  const commercialVerdict = blocked ? { blocked: true, reason: blocked.reason } : { blocked: false };
  return {
    candidates,
    ...(chosen === undefined ? {} : { chosen }),
    commercialVerdict,
    commercialPolicyVersion: version,
  };
}

function evidenceOf(found: ProductTruth): Evidence {
  if (found.kind === "unknown") {
    const attributes = new Map<string, string>();
    return {
      product: { attributes },
      truth: { kind: found.reason },
      // Stryker disable next-line BooleanLiteral: the decision policy refuses an unknown truth before the gate sees it
      gate: { attributes, stockAndPriceFresh: false },
      record: { truth: found.reason },
    };
  }
  const attributes = new Map(found.product.attributes.map((a) => [a.key, a.value]));
  const stockAndPrice = found.stockAndPrice;
  const stockAndPriceFresh = stockAndPrice === "fresh";
  if (found.kind === "known-product") {
    return {
      product: { attributes },
      truth: { kind: found.kind, stockAndPrice },
      gate: { attributes, stockAndPriceFresh },
      record: { truth: found.kind, stockAndPrice },
    };
  }
  const available = found.variant.available;
  return {
    product: { attributes, available },
    truth: { kind: found.kind, stockAndPrice, available },
    gate: { attributes, stockAndPriceFresh, available },
    record: { truth: found.kind, stockAndPrice, available },
  };
}
