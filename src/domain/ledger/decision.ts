// Decision (01-arquitectura-mvp.md §5, §7; constitution II): it always exists, with a reason. The
// ledger knows nothing about batches or events: it records what other modules decide.
import type {
  Arm,
  DecisionId,
  ExperimentId,
  MerchantId,
  SessionId,
  VisitorId,
} from "../shared-kernel/index.js";

export type Anchor = "size_selector" | "price" | "cta" | "policies";

/** Placeholder for the decision plane (PROPUESTO in the contract). */
export interface Intervention {
  messageVersionId: string;
  anchor: Anchor;
}

export type DecisionOutcome = "NO_OP" | "INTERVENE";

export interface Decision {
  decisionId: DecisionId;
  merchantId: MerchantId;
  sessionId: SessionId;
  visitorId: VisitorId;
  decidedAt: Date;
  outcome: DecisionOutcome;
  /** Reason for the outcome: a slug of the catalogue `contracts/no-op-reasons.yaml` when NO_OP. */
  reason: string;
  /** The experiment and arm the visitor was assigned to; absent when the merchant has no active experiment. */
  experiment?: DecisionExperiment;
  intervention?: Intervention;
}

export interface DecisionExperiment {
  experimentId: ExperimentId;
  arm: Arm;
}

export type NoOpInput = Omit<Decision, "outcome" | "intervention">;

export function noOp(input: NoOpInput): Decision {
  return { ...input, outcome: "NO_OP" };
}
