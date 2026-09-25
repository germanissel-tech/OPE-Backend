// What can be said for a batch (feature 027): the barrier inference, the barrier the policies
// settle on, and the candidates that survive being sayable and being judged.
//
// It exists because two things belong together and neither belongs in the orchestrator: inferring
// the barrier, and knowing which candidate families have a curated text. **A family without a text
// is not a candidate** (01 §322), so the text is resolved *before* the quality gate and the gate
// judges only what could be said — which is why the gate itself did not have to change a line and
// stays a pure function (constitution II).
//
// The orchestrator keeps only its job: build the context, invoke in order (constitution I). It does
// not infer and it does not choose a message; it asks this service and passes the answer on.
import { type Signals, type ProductFacts, type Inference } from "../../../domain/barrier/index.js";
import { CANDIDATES, QualityGate, type GateEvidence, type Judged } from "../../../domain/selection/index.js";
import type { BarrierVerdict, TruthSummary } from "../../../domain/decision/index.js";
import type { Barrier, MerchantId, NoOpReason } from "../../../domain/shared-kernel/index.js";
import type { BarrierInference } from "../../barrier/index.js";
import type { MessagePlane } from "../ports/message-plane.js";
import type { MerchantPolicies } from "../ports/policy-directory.js";

export interface CandidatesDependencies {
  inference: BarrierInference;
  messages: MessagePlane;
}

export interface CandidatesRequest {
  merchantId: MerchantId;
  policies: MerchantPolicies;
  signals: Signals;
  product: ProductFacts;
  truth: TruthSummary;
  evidence: GateEvidence;
  /** Whether the session was abandoned: the commercial policy may settle on a barrier because of it. */
  abandoned: boolean;
  locale?: string;
  attributes: ReadonlyMap<string, string>;
}

export interface CandidatesResult {
  /** What the rules inferred, for the ledger: the plane records how it reasoned, not only what it chose. */
  inference: Inference;
  /**
   * Why no intervention can be sustained at all, when none can: the barrier's evidence, or no
   * candidate with a curated text. It travels so the ladder does not have to invent a reason —
   * `message-unavailable` and `no-acceptable-candidate` are different facts (01 §322, FR-016).
   */
  unsustainable?: NoOpReason;
  settled: BarrierVerdict;
  /** The barrier to select for: the inferred one, or the one an abandonment brings. */
  barrier?: Barrier;
  judged: readonly Judged[];
}

const MESSAGE_UNAVAILABLE: NoOpReason = "message-unavailable";

/** The role the plane depends on: what can be said for a batch, and how the barrier was reasoned. */
export interface CandidatesService {
  for(request: CandidatesRequest): Promise<CandidatesResult>;
}

export class Candidates implements CandidatesService {
  readonly #inference: BarrierInference;
  readonly #messages: MessagePlane;

  constructor(dependencies: CandidatesDependencies) {
    this.#inference = dependencies.inference;
    this.#messages = dependencies.messages;
  }

  /** The inference and the candidates that survive being sayable and being judged, in ladder order. */
  async for(request: CandidatesRequest): Promise<CandidatesResult> {
    const { policies } = request;
    const inference = await this.#inference.infer({
      rules: policies.decision.rules,
      signals: request.signals,
      product: request.product,
    });
    const settled = policies.decision.barrierVerdict({
      inference,
      truth: request.truth,
      active: policies.barriers,
    });
    const barrier = policies.commercial.fallbackBarrier(settled.barrier, request.abandoned);
    const found = barrier === undefined ? {} : { barrier };
    if (barrier === undefined || settled.evidenceReason !== undefined) {
      const unsustainable = settled.evidenceReason;
      return {
        inference,
        settled,
        ...found,
        // Stryker disable next-line ConditionalExpression: an absent key and an undefined one are the same input
        ...(unsustainable === undefined ? {} : { unsustainable }),
        judged: [],
      };
    }
    const sayable = await this.#messages.sayable({
      merchantId: request.merchantId,
      candidates: CANDIDATES[barrier],
      ...(request.locale === undefined ? {} : { locale: request.locale }),
      attributes: request.attributes,
    });
    // Nothing sayable is not nothing acceptable: the family is not a candidate because nobody
    // wrote its text, which is a different fact and a different reason (01 §322).
    if (sayable.length === 0) {
      return { inference, settled, ...found, unsustainable: MESSAGE_UNAVAILABLE, judged: [] };
    }
    return {
      inference,
      settled,
      ...found,
      judged: QualityGate.of(policies.profile).judgeAll(sayable, request.evidence),
    };
  }
}
