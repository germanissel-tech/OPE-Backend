// The decision plane (01-arquitectura-mvp.md §4; constitution I; ADR-026): the orchestrator of
// the critical path for one batch. It builds the context and invokes the authorities in a fixed
// order — assignment → barrier inference → product evidence → verdict — and hands the decision
// to the ledger. It infers nothing and chooses nothing itself. Implements the port the
// ingestion declares (DecisionPlane), so the ingestion never depends on this module.
//
// Fail-closed at every step (constitution II): a page without a resolved product decides
// nothing about a product; an assignment the ledger could not record degrades to NO_OP
// `ledger-unavailable` (ADR-021); and only an intervention the ledger accepted counts against
// the session budget — the budget measures what the visitor saw.
import { Signals, type ProductFacts } from "../../../domain/barrier/index.js";
import { asProductId, asVariantId } from "../../../domain/catalog/index.js";
import { VISITOR_WINDOW } from "../policies/visitor-window.js";
import type { StateService } from "./state.service.js";
import type { DecisionPolicy, SessionState, TruthSummary, Verdict } from "../../../domain/decision/index.js";
import type { ProductFocus } from "../../../domain/ingestion/index.js";
import type { Decision, DecisionInference, EvidenceRecord } from "../../../domain/ledger/index.js";
import type { Arm, MerchantId, NoOpReason } from "../../../domain/shared-kernel/index.js";
import type { BarrierInference } from "../../barrier/index.js";
import type { ProductTruth, ProductTruthService } from "../../catalog/index.js";
import type { AssignmentService } from "../../experiment/index.js";
import type { DecisionPlane, DecisionRequest } from "../../ingestion/index.js";
import type { DecisionFactsInput, DecisionOutcomeInput, DecisionRecorder } from "../../ledger/index.js";
import type { DecisionPolicyDirectory } from "../ports/decision-policy-directory.js";

export interface DecisionServiceDependencies {
  assignment: AssignmentService;
  policies: DecisionPolicyDirectory;
  state: StateService;
  inference: BarrierInference;
  truth: ProductTruthService;
  recorder: DecisionRecorder;
}

const PAGE_CONTEXT_INCOMPLETE: NoOpReason = "page-context-incomplete";

/** The product truth of the focus, as the authorities need it: facts for the rules, a summary for the verdict, a record for the ledger. */
interface Evidence {
  product: ProductFacts;
  truth: TruthSummary;
  record: EvidenceRecord;
}

/** The context the orchestrator hands to the inference and the verdict. */
interface JudgeInput {
  policy: DecisionPolicy;
  state: SessionState;
  arm?: Arm;
  evidence: Evidence;
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
    const facts: DecisionFactsInput = { ...whose, decidedAt: now };

    const assigned = await assignment.assign(merchantId, visitorId);
    if (!assigned.ok) return recorder.unrecorded(facts, "assignment not recorded");
    if (assigned.value)
      facts.experiment = { experimentId: assigned.value.experimentId, arm: assigned.value.arm };

    const policy = await policies.policyFor(merchantId);
    const remembered = await memory.recall(whose, now);
    const state = remembered.session.absorb(Signals.of(batch.events), now);

    const focus = batch.focus();
    let outcome: DecisionOutcomeInput = { kind: "no-op", reason: PAGE_CONTEXT_INCOMPLETE };
    if (focus !== undefined) {
      const evidence = await this.#evidence(merchantId, focus);
      const arm = assigned.value?.arm;
      const judged = await this.#judge({ policy, state, evidence, ...(arm === undefined ? {} : { arm }) });
      facts.inference = judged.inference;
      outcome = outcomeOf(judged.verdict);
    }

    const decision = await recorder.record(facts, outcome);
    const intervened = decision.isIntervention();
    await memory.remember(
      whose,
      intervened
        ? {
            session: state.withIntervention(now),
            visitor: remembered.visitor.withIntervention(now, VISITOR_WINDOW.ttlMs),
          }
        : { session: state },
    );
    return decision;
  }

  /** Inference over the session, then the policy's verdict; the ledger gets how it was reasoned. */
  async #judge({
    policy,
    state,
    arm,
    evidence,
  }: JudgeInput): Promise<{ verdict: Verdict; inference: DecisionInference }> {
    const inference = await this.#deps.inference.infer({
      rules: policy.rules,
      signals: state.signals,
      product: evidence.product,
    });
    const verdict = policy.verdict({
      // Stryker disable next-line ConditionalExpression: an explicit `arm: undefined` reads the same as an absent arm
      ...(arm === undefined ? {} : { arm }),
      inference,
      abandoned: state.abandoned(),
      truth: evidence.truth,
      interventionsSoFar: state.interventions,
      addedToCart: state.addedToCart(),
      enteredCheckout: state.enteredCheckout(),
    });
    return {
      verdict,
      inference: {
        policyVersion: policy.version,
        confidences: inference.confidences,
        matched: inference.matched,
        trigger: verdict.trigger,
        evidence: evidence.record,
        ...(verdict.barrier === undefined ? {} : { barrier: verdict.barrier }),
      },
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

function outcomeOf(verdict: Verdict): DecisionOutcomeInput {
  return verdict.kind === "no-op"
    ? { kind: "no-op", reason: verdict.reason }
    : { kind: "intervene", reason: verdict.barrier, intervention: verdict.intervention };
}

function evidenceOf(found: ProductTruth): Evidence {
  if (found.kind === "unknown") {
    return {
      product: { attributes: new Map() },
      truth: { kind: found.reason },
      record: { truth: found.reason },
    };
  }
  const attributes = new Map(found.product.attributes.map((a) => [a.key, a.value]));
  const stockAndPrice = found.freshness.stockAndPrice;
  if (found.kind === "known-product") {
    return {
      product: { attributes },
      truth: { kind: found.kind, stockAndPrice },
      record: { truth: found.kind, stockAndPrice },
    };
  }
  const available = found.variant.available;
  return {
    product: { attributes, available },
    truth: { kind: found.kind, stockAndPrice, available },
    record: { truth: found.kind, stockAndPrice, available },
  };
}
