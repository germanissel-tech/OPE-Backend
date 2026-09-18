// Decision policy of a merchant (01-arquitectura-mvp.md §4.2–§4.5; ADR-026): the barrier rules
// the inference authority evaluates, plus how the verdict is reached — threshold, priority on a
// tie, what counts as high intent, what to do on a cart abandonment without a signal, how many
// interventions a session may receive and which evidence each barrier needs. A policy only
// exists valid, is versioned (changing it is a new experiment, ADR-022) and its verdict is
// pure: the orchestrator brings the facts, the policy answers.
import {
  BARRIERS,
  fail,
  ok,
  type Anchor,
  type Arm,
  type Barrier,
  type Intervention,
  type NoOpReason,
  type Result,
} from "../shared-kernel/index.js";
import {
  InvalidPolicyEvidence,
  InvalidPolicyPriority,
  InvalidPolicyThreshold,
  InvalidPolicyVersion,
  InvalidSessionBudget,
  type DecisionError,
} from "./errors.js";
import type { BarrierRules, Inference } from "../barrier/index.js";

export type HighIntent = "from-cart" | "from-checkout" | "never";
export type Abandonment = "nothing" | "reassure-returns";

/** Which barriers need fresh stock and price, and which must never recommend an unavailable variant. */
export interface EvidenceRequirements {
  freshStockAndPrice: readonly Barrier[];
  availableVariant: readonly Barrier[];
}

export interface DecisionPolicyRecord {
  version: string;
  rules: BarrierRules;
  threshold: number;
  priority: readonly Barrier[];
  highIntent: HighIntent;
  abandonment: Abandonment;
  interventionsPerSession: number;
  evidence: EvidenceRequirements;
}

/** What the verdict needs to know about the product truth (catalog module answers it). */
export interface TruthSummary {
  kind: "known" | "known-product" | "absent" | "stale" | "unknown-product" | "unknown-variant";
  stockAndPrice?: "fresh" | "stale";
  available?: boolean;
}

export interface VerdictInput {
  /** Absent when the merchant has no active experiment. */
  arm?: Arm;
  inference: Inference;
  /** The session added to the cart and then removed (the abandonment the policy may answer). */
  abandoned: boolean;
  truth: TruthSummary;
  interventionsSoFar: number;
  addedToCart: boolean;
  enteredCheckout: boolean;
}

export type Trigger = "rules" | "abandonment" | "none";

interface Candidate {
  barrier: Barrier;
  confidence: number;
  trigger: "rules" | "abandonment";
}

export type Verdict =
  | {
      kind: "intervene";
      barrier: Barrier;
      confidence: number;
      trigger: "rules" | "abandonment";
      intervention: Intervention;
    }
  | { kind: "no-op"; reason: NoOpReason; trigger: Trigger; barrier?: Barrier; confidence?: number };

/** Where each barrier speaks (01 §3.1.1): fit by the size selector, price under the price, returns by the policies. */
export const ANCHOR_BY_BARRIER: Readonly<Record<Barrier, Anchor>> = {
  fit: "size_selector",
  price: "price",
  returns: "policies",
};

/** Until the message catalogue (feature 015) the message reference is a placeholder per barrier and anchor. */
const MESSAGE_PLACEHOLDER_VERSION = "v0";
const REASSURANCE_BARRIER: Barrier = "returns";

const isShare = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1;

export class DecisionPolicy {
  readonly version: string;
  readonly rules: BarrierRules;
  readonly threshold: number;
  readonly priority: readonly Barrier[];
  readonly highIntent: HighIntent;
  readonly abandonment: Abandonment;
  readonly interventionsPerSession: number;
  readonly evidence: EvidenceRequirements;

  private constructor(record: DecisionPolicyRecord) {
    this.version = record.version;
    this.rules = record.rules;
    this.threshold = record.threshold;
    this.priority = record.priority;
    this.highIntent = record.highIntent;
    this.abandonment = record.abandonment;
    this.interventionsPerSession = record.interventionsPerSession;
    this.evidence = record.evidence;
  }

  /**
   * A policy, or the first violated invariant: version not blank, threshold in 0..1, priority
   * an exact permutation of the barriers, at least one intervention per session, evidence
   * requirements naming only barriers. The rules were already judged by `BarrierRules.of`.
   */
  static of(record: DecisionPolicyRecord): Result<DecisionPolicy, DecisionError> {
    if (record.version.trim() === "") return fail(new InvalidPolicyVersion());
    if (!isShare(record.threshold)) return fail(new InvalidPolicyThreshold());
    const permutation =
      record.priority.length === BARRIERS.length && BARRIERS.every((b) => record.priority.includes(b));
    if (!permutation) return fail(new InvalidPolicyPriority());
    if (!Number.isInteger(record.interventionsPerSession) || record.interventionsPerSession < 1) {
      return fail(new InvalidSessionBudget());
    }
    for (const field of ["freshStockAndPrice", "availableVariant"] as const) {
      const unknown = record.evidence[field].find((b) => !(BARRIERS as readonly string[]).includes(b));
      if (unknown !== undefined) return fail(new InvalidPolicyEvidence(field, unknown));
    }
    return ok(new DecisionPolicy({ ...record, priority: [...record.priority] }));
  }

  /** A policy a store recorded: its invariants are not re-judged. */
  static rehydrate(record: DecisionPolicyRecord): DecisionPolicy {
    return new DecisionPolicy(record);
  }

  anchorFor(barrier: Barrier): Anchor {
    return ANCHOR_BY_BARRIER[barrier];
  }

  messageFor(barrier: Barrier): string {
    return `msg_${barrier}_${this.anchorFor(barrier)}_${MESSAGE_PLACEHOLDER_VERSION}`;
  }

  /**
   * The verdict, in a fixed order (01 §4): no experiment → CONTROL → high intent → session
   * budget → a candidate (the dominant barrier over the threshold, ties by priority; or the
   * abandonment reassurance) → the evidence the candidate needs → intervene. Every NO_OP
   * carries the candidate the ledger should keep.
   */
  verdict(input: VerdictInput): Verdict {
    const candidate = this.#candidate(input);
    const noOp = (reason: NoOpReason): Verdict =>
      candidate === undefined
        ? { kind: "no-op", reason, trigger: "none" }
        : { kind: "no-op", reason, ...candidate };
    if (input.arm === undefined) return noOp("no-active-experiment");
    if (input.arm === "CONTROL") return noOp("control-arm");
    if (this.#highIntent(input)) return noOp("high-intent");
    if (input.interventionsSoFar >= this.interventionsPerSession) return noOp("session-budget-exhausted");
    if (candidate === undefined) return noOp("barrier-unclear");
    const missing = this.#missingEvidence(candidate.barrier, input.truth);
    if (missing !== undefined) return noOp(missing);
    const intervention: Intervention = {
      anchor: this.anchorFor(candidate.barrier),
      messageVersionId: this.messageFor(candidate.barrier),
    };
    return { kind: "intervene", ...candidate, intervention };
  }

  /** The dominant barrier over the threshold (ties by priority), or the reassurance on an abandonment. */
  #candidate({ inference, abandoned }: VerdictInput): Candidate | undefined {
    let best: Candidate | undefined;
    for (const barrier of this.priority) {
      const confidence = inference.confidences[barrier];
      if (confidence >= this.threshold && (best === undefined || confidence > best.confidence)) {
        best = { barrier, confidence, trigger: "rules" };
      }
    }
    if (best !== undefined) return best;
    if (abandoned && this.abandonment === "reassure-returns") {
      return {
        barrier: REASSURANCE_BARRIER,
        confidence: this.rules.weights.supporting,
        trigger: "abandonment",
      };
    }
    return undefined;
  }

  #highIntent({ addedToCart, enteredCheckout }: VerdictInput): boolean {
    switch (this.highIntent) {
      case "from-checkout":
        return enteredCheckout;
      case "from-cart":
        return addedToCart || enteredCheckout;
      case "never":
        return false;
    }
  }

  /** Why the evidence cannot sustain what this barrier would say, or undefined when it can. */
  #missingEvidence(barrier: Barrier, truth: TruthSummary): NoOpReason | undefined {
    switch (truth.kind) {
      case "absent":
      case "unknown-product":
      case "unknown-variant":
        return "evidence-missing";
      case "stale":
        return "evidence-stale";
      case "known-product":
      case "known": {
        const needsVariant = this.evidence.availableVariant.includes(barrier);
        if (needsVariant && truth.kind === "known-product") return "evidence-missing";
        if (this.evidence.freshStockAndPrice.includes(barrier) && truth.stockAndPrice === "stale") {
          return "evidence-stale";
        }
        return needsVariant && truth.available === false ? "variant-unavailable" : undefined;
      }
    }
  }
}
