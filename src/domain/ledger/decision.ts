// Decision (01-arquitectura-mvp.md §5, §7; constitution II; ADR-024): it always exists, with a
// reason. Two shapes and nothing in between: NO_OP with a reason of the catalogue, INTERVENE
// with its intervention. The ledger knows nothing about batches or events: it records what
// other modules decide. A decision is built by its factory or rehydrated from the ledger; its
// shapes carry no rule beyond what the types express, so `of` and `rehydrate` agree.
import {
  NO_OP_REASONS,
  type Arm,
  type ExperimentId,
  type MerchantId,
  type NoOpReason,
  type SessionId,
  type VisitorId,
} from "../shared-kernel/index.js";
import type { DecisionId } from "./ids.js";

const isNoOpReason = (reason: string): reason is NoOpReason =>
  (NO_OP_REASONS as readonly string[]).includes(reason);

export type Anchor = "size_selector" | "price" | "cta" | "policies";

/** Placeholder for the decision plane (PROPUESTO in the contract). */
export interface Intervention {
  messageVersionId: string;
  anchor: Anchor;
}

export type DecisionOutcome = "NO_OP" | "INTERVENE";
const NO_OP = "NO_OP" satisfies DecisionOutcome;
const INTERVENE = "INTERVENE" satisfies DecisionOutcome;

export interface DecisionExperiment {
  experimentId: ExperimentId;
  arm: Arm;
}

/** What every decision carries, whatever its outcome. */
export interface DecisionFacts {
  decisionId: DecisionId;
  merchantId: MerchantId;
  sessionId: SessionId;
  visitorId: VisitorId;
  decidedAt: Date;
  /** The experiment and arm the visitor was assigned to; absent when the merchant has no active experiment. */
  experiment?: DecisionExperiment;
}

/** A decision as the ledger stores it: the facts plus the outcome and what the outcome carries. */
export interface DecisionRecord extends DecisionFacts {
  outcome: DecisionOutcome;
  reason: string;
  intervention?: Intervention;
}

export abstract class DecisionBase implements DecisionFacts {
  readonly decisionId: DecisionId;
  readonly merchantId: MerchantId;
  readonly sessionId: SessionId;
  readonly visitorId: VisitorId;
  readonly decidedAt: Date;
  readonly experiment?: DecisionExperiment;
  abstract readonly outcome: DecisionOutcome;
  /** Why this outcome: a NO_OP reason of the catalogue, or the reason of the intervention. */
  abstract readonly reason: string;

  protected constructor(facts: DecisionFacts) {
    this.decisionId = facts.decisionId;
    this.merchantId = facts.merchantId;
    this.sessionId = facts.sessionId;
    this.visitorId = facts.visitorId;
    this.decidedAt = facts.decidedAt;
    if (facts.experiment) this.experiment = facts.experiment;
  }

  /** A recorded decision comes back as what it was; a record that fits no shape is corrupt. */
  static rehydrate(record: DecisionRecord): Decision {
    const { outcome, reason, intervention, ...facts } = record;
    if (outcome === NO_OP) {
      if (!isNoOpReason(reason))
        throw new Error(`Decision ${record.decisionId} is NO_OP with an unknown reason.`);
      return NoOpDecision.of(facts, reason);
    }
    if (intervention === undefined)
      throw new Error(`Decision ${record.decisionId} is INTERVENE without an intervention.`);
    return InterveneDecision.of(facts, reason, intervention);
  }

  /** Is this the decision of that session and visitor? Nothing else is revealed about a foreign one. */
  belongsTo(sessionId: SessionId, visitorId: VisitorId): boolean {
    return this.sessionId === sessionId && this.visitorId === visitorId;
  }

  isIntervention(): this is InterveneDecision {
    return this.outcome === INTERVENE;
  }
}

export class NoOpDecision extends DecisionBase {
  readonly outcome = NO_OP;
  readonly reason: NoOpReason;

  private constructor(facts: DecisionFacts, reason: NoOpReason) {
    super(facts);
    this.reason = reason;
  }

  static of(facts: DecisionFacts, reason: NoOpReason): NoOpDecision {
    return new NoOpDecision(facts, reason);
  }
}

export class InterveneDecision extends DecisionBase {
  readonly outcome = INTERVENE;
  readonly reason: string;
  readonly intervention: Intervention;

  private constructor(facts: DecisionFacts, reason: string, intervention: Intervention) {
    super(facts);
    this.reason = reason;
    this.intervention = intervention;
  }

  static of(facts: DecisionFacts, reason: string, intervention: Intervention): InterveneDecision {
    return new InterveneDecision(facts, reason, intervention);
  }
}

export type Decision = NoOpDecision | InterveneDecision;
