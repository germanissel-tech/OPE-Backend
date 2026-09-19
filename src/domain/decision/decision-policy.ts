// Decision policy of a merchant (01-arquitectura-mvp.md §4.2–§4.3; ADR-026, ADR-027): the barrier
// rules the inference authority evaluates, plus how the barrier is settled — threshold,
// priority on a tie — and which evidence each barrier needs before anything is said about it.
// What is commercial (high intent, the abandonment answer, budgets) is the commercial policy's
// (feature 012). A policy only exists valid, is versioned (changing it is a new experiment,
// ADR-022) and its verdict is pure: the orchestrator brings the facts, the policy answers.
import { BARRIERS, fail, ok, type Barrier, type NoOpReason, type Result } from "../shared-kernel/index.js";
import {
  InvalidPolicyEvidence,
  InvalidPolicyPriority,
  InvalidPolicyThreshold,
  InvalidPolicyVersion,
  type DecisionError,
} from "./errors.js";
import type { BarrierRules, Inference } from "../barrier/index.js";

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
  evidence: EvidenceRequirements;
}

/** What the verdict needs to know about the product truth (catalog module answers it). */
export interface TruthSummary {
  kind: "known" | "known-product" | "absent" | "stale" | "unknown-product" | "unknown-variant";
  stockAndPrice?: "fresh" | "stale";
  available?: boolean;
}

export interface BarrierVerdictInput {
  inference: Inference;
  truth: TruthSummary;
}

/** The barrier the rules settled on, if any, and whether its evidence can sustain it. */
export interface BarrierVerdict {
  barrier?: Barrier;
  confidence?: number;
  evidenceReason?: NoOpReason;
}

const isShare = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1;

export class DecisionPolicy {
  readonly version: string;
  readonly rules: BarrierRules;
  readonly threshold: number;
  readonly priority: readonly Barrier[];
  readonly evidence: EvidenceRequirements;

  private constructor(record: DecisionPolicyRecord) {
    this.version = record.version;
    this.rules = record.rules;
    this.threshold = record.threshold;
    this.priority = record.priority;
    this.evidence = record.evidence;
  }

  /**
   * A policy, or the first violated invariant: version not blank, threshold in 0..1, priority
   * an exact permutation of the barriers, evidence requirements naming only barriers. The rules
   * were already judged by `BarrierRules.of`.
   */
  static of(record: DecisionPolicyRecord): Result<DecisionPolicy, DecisionError> {
    if (record.version.trim() === "") return fail(new InvalidPolicyVersion());
    if (!isShare(record.threshold)) return fail(new InvalidPolicyThreshold());
    const permutation =
      record.priority.length === BARRIERS.length && BARRIERS.every((b) => record.priority.includes(b));
    if (!permutation) return fail(new InvalidPolicyPriority());
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

  /**
   * The dominant barrier over the threshold (ties by priority) and, when there is one, whether
   * the evidence can sustain it (01 §4.3): absent truth ⇒ `evidence-missing`, stale ⇒
   * `evidence-stale`, an unavailable variant where the barrier would recommend it ⇒
   * `variant-unavailable`, no variant where the barrier needs one ⇒ `evidence-missing`.
   */
  barrierVerdict({ inference, truth }: BarrierVerdictInput): BarrierVerdict {
    let best: { barrier: Barrier; confidence: number } | undefined;
    for (const barrier of this.priority) {
      const confidence = inference.confidences[barrier];
      if (confidence >= this.threshold && (best === undefined || confidence > best.confidence)) {
        best = { barrier, confidence };
      }
    }
    if (best === undefined) return {};
    const evidenceReason = this.#missingEvidence(best.barrier, truth);
    return evidenceReason === undefined ? best : { ...best, evidenceReason };
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
