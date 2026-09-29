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
import { FactContext, Signals } from "../../../domain/barrier/index.js";
import { asProductId, asVariantId } from "../../../domain/catalog/index.js";
import { evidenceOf, outcomeOf, selectionOf, triggerOf, type Evidence } from "./decision-shapes.js";
import type { CandidatesService } from "./candidates.service.js";
import type { StateService } from "./state.service.js";
import type { CommercialVerdict } from "../../../domain/commercial/index.js";
import type { SessionState } from "../../../domain/decision/index.js";
import type { ProductFocus } from "../../../domain/ingestion/index.js";
import type {
  Decision,
  DecisionInference,
  DecisionPhase,
  DecisionSelection,
} from "../../../domain/ledger/index.js";
import type { Arm, MerchantId, NoOpReason } from "../../../domain/shared-kernel/index.js";
import type { ProductTruthService } from "../../catalog/index.js";
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
/** Feature 032, FR-013: the interventions the caps are counted from could not be read. */
const STATE_UNAVAILABLE: NoOpReason = "state-unavailable";
/** The phase a decision records while the experiment calibrates (03 §4.10). */
const CALIBRATION: DecisionPhase = "calibration";

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
    const facts: DecisionFactsInput = {
      ...whose,
      decidedAt: now,
      configuration: merchant.versions,
      // How many events the batch that triggered this decision carried (feature 031). It is here and
      // nowhere else because this is the one durable, synchronous record of that batch: with it, a hole
      // in the event register can be named **in events** and not only in batches (FR-018).
      eventsInBatch: batch.events.length,
    };

    // The kill switch comes before the assignment: off, nothing is assigned, nothing is consumed.
    if (!merchant.enabled) return recorder.record(facts, { kind: "no-op", reason: MERCHANT_OFF });

    const assigned = await assignment.assign(merchantId, visitorId);
    if (!assigned.ok) return recorder.unrecorded(facts, "assignment not recorded");
    if (assigned.value) {
      const { assignment, phase } = assigned.value;
      facts.experiment = { experimentId: assignment.experimentId, arm: assignment.arm };
      if (phase === CALIBRATION) facts.phase = CALIBRATION;
    }

    const recalled = await memory.recall(whose, now);
    // Nothing could say what this visitor already received, so the plane fails closed (constitution
    // II, FR-013) — and records the degraded decision, because one is still a decision (IX).
    if (!recalled.ok) return recorder.record(facts, { kind: "no-op", reason: STATE_UNAVAILABLE });
    const remembered = recalled.value;
    // FR-015: the register was short, so this decision saw only its own batch. Recorded rather than
    // degraded — the other half of the asymmetry, whose argument is in `state.service.ts`.
    if (remembered.signalsIncomplete) facts.signalsIncomplete = true;
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
