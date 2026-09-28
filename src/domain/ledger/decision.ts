// Decision (01-arquitectura-mvp.md §5, §7; constitution II; ADR-024): it always exists, with a
// reason. Two shapes and nothing in between: NO_OP with a reason of the catalogue, INTERVENE
// with its intervention. The ledger knows nothing about batches or events: it records what
// other modules decide. A decision is built by its factory or rehydrated from the ledger; its
// shapes carry no rule beyond what the types express, so `of` and `rehydrate` agree.
import {
  NO_OP_REASONS,
  type Arm,
  type Barrier,
  type ConfigurationVersions,
  type ExperimentId,
  type Intervention,
  type MerchantId,
  type NoOpReason,
  type SessionId,
  type VisitorId,
} from "../shared-kernel/index.js";
import type { DecisionId } from "./ids.js";

const isNoOpReason = (reason: string): reason is NoOpReason =>
  (NO_OP_REASONS as readonly string[]).includes(reason);

export type DecisionOutcome = "NO_OP" | "INTERVENE";
const NO_OP = "NO_OP" satisfies DecisionOutcome;
const INTERVENE = "INTERVENE" satisfies DecisionOutcome;

export interface DecisionExperiment {
  experimentId: ExperimentId;
  arm: Arm;
}

/** What the plane knew about the product when it decided (01 §4.3). */
export interface EvidenceRecord {
  truth:
    "known" | "known-product" | "absent" | "stale" | "unknown-product" | "unknown-variant" | "not-consulted";
  stockAndPrice?: "fresh" | "stale";
  available?: boolean;
}

/**
 * How the plane reasoned (constitution IX): the version of the policy, the confidence of every
 * barrier, the rules that matched, the barrier it settled on (if any), what triggered the
 * candidate and the evidence it consulted. Typed with the kernel's vocabulary only: the ledger
 * records what other modules decide without depending on them.
 */
export interface DecisionInference {
  policyVersion: string;
  confidences: Readonly<Record<Barrier, number>>;
  matched: readonly string[];
  barrier?: Barrier;
  trigger: "rules" | "abandonment" | "none";
  evidence: EvidenceRecord;
}

/** One candidate intervention as the quality gate judged it (feature 012, constitution IX). */
export interface CandidateRecord {
  candidateId: string;
  step: string;
  verdict: "acceptable" | "unacceptable";
  reason?: string;
}

/**
 * How the plane selected (feature 012): every candidate with its gate verdict, the one chosen
 * (or the one the commercial policy blocked), the commercial verdict and the version of the
 * commercial policy. Strings only: the ledger records what other modules decide.
 */
export interface DecisionSelection {
  candidates: readonly CandidateRecord[];
  chosen?: string;
  commercialVerdict: { blocked: boolean; reason?: string };
  commercialPolicyVersion: string;
}

export type DecisionPhase = "calibration";

/** What every decision carries, whatever its outcome. */
export interface DecisionFacts {
  decisionId: DecisionId;
  merchantId: MerchantId;
  sessionId: SessionId;
  visitorId: VisitorId;
  decidedAt: Date;
  /** The three versions the decision was taken with (01 §14.2): platform, treatment defaults and, if any, the merchant's. */
  configuration: ConfigurationVersions;
  /**
   * How many events the batch that triggered this decision carried (feature 031).
   *
   * It lives here because **this is the only durable, synchronous record of that batch**: the event
   * register is written from a queue and can lose what it holds, so reconciling the two at start-up is
   * what names a hole — and without this number the hole could only be named in batches, while SC-010
   * asks for events. It changes no verdict and no response.
   *
   * **Optional, and not for convenience**: a decision recorded before this feature does not have one,
   * `rehydrate` does not judge what it reads (ADR-024), and a required field would therefore be a type
   * that lies about the history this system promises to keep. Where it is absent the hole is nameable
   * in batches only, which is the truth about those rows.
   */
  eventsInBatch?: number | undefined;
  /**
   * The register of events could not be read while this session was being rebuilt, so the decision was
   * taken with the signals of its own batch and nothing before it (feature 032, FR-015).
   *
   * **It is here so that analysis can tell two things apart that otherwise look identical**: a visit
   * where nothing happened before this batch, and a visit whose history could not be read. Without it
   * the second is silently counted as the first, which is a false figure in the one place — the pilot —
   * where figures are the product.
   *
   * Absent means the signals were whole, which is every decision the system has recorded so far and
   * nearly every one it will. Only the exception says so, so no document grows a field to say "normal".
   */
  signalsIncomplete?: true | undefined;
  /** `calibration` while the open experiment is calibrating (03 §4.10); absent in accumulation or without an experiment. */
  phase?: DecisionPhase | undefined;
  /** The experiment and arm the visitor was assigned to; absent when the merchant has no active experiment. */
  experiment?: DecisionExperiment | undefined;
  /** Absent only when the plane did not get to infer (no product in focus, ledger down before deciding). */
  inference?: DecisionInference | undefined;
  /** Absent when the plane did not get to select (no inference, or no barrier to select for). */
  selection?: DecisionSelection | undefined;
  /** Language of the page in focus (BCP 47), so the message catalogue can pick the text; absent when the SDK did not read one. */
  locale?: string | undefined;
}

/** A decision as the ledger stores it: the facts plus the outcome and what the outcome carries. */
export interface DecisionRecord extends DecisionFacts {
  outcome: DecisionOutcome;
  reason: string;
  intervention?: Intervention | undefined;
}

export abstract class DecisionBase implements DecisionFacts {
  readonly decisionId: DecisionId;
  readonly merchantId: MerchantId;
  readonly sessionId: SessionId;
  readonly visitorId: VisitorId;
  readonly decidedAt: Date;
  readonly configuration: ConfigurationVersions;
  readonly phase?: DecisionPhase;
  readonly experiment?: DecisionExperiment;
  readonly inference?: DecisionInference;
  readonly selection?: DecisionSelection;
  readonly locale?: string;
  readonly eventsInBatch?: number;
  readonly signalsIncomplete?: true;
  abstract readonly outcome: DecisionOutcome;
  /** Why this outcome: a NO_OP reason of the catalogue, or the reason of the intervention. */
  abstract readonly reason: string;

  protected constructor(facts: DecisionFacts) {
    this.decisionId = facts.decisionId;
    this.merchantId = facts.merchantId;
    this.sessionId = facts.sessionId;
    this.visitorId = facts.visitorId;
    this.decidedAt = facts.decidedAt;
    this.configuration = { ...facts.configuration };
    if (facts.phase !== undefined) this.phase = facts.phase;
    if (facts.experiment) this.experiment = facts.experiment;
    if (facts.inference) this.inference = facts.inference;
    if (facts.selection) this.selection = facts.selection;
    if (facts.locale !== undefined) this.locale = facts.locale;
    if (facts.eventsInBatch !== undefined) this.eventsInBatch = facts.eventsInBatch;
    if (facts.signalsIncomplete !== undefined) this.signalsIncomplete = facts.signalsIncomplete;
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

  /**
   * The record as a ledger would store it: the counterpart of `rehydrate`, so a store never has
   * to know which optional fields this class happens to assign.
   *
   * **A field it never had travels as `undefined`, not as an absent key**, and the two are the
   * same thing here: `JSON.stringify` drops both, and the constructor only assigns what is not
   * `undefined`. Guarding each one —`...(x === undefined ? {} : { x })`— would write the same
   * document through two branches no test could tell apart, which is the shape of survivor this
   * repository keeps producing (`.claude/rules/gates-de-calidad.md`). `Order.record` was already
   * written this way.
   */
  record(): DecisionRecord {
    return {
      decisionId: this.decisionId,
      merchantId: this.merchantId,
      sessionId: this.sessionId,
      visitorId: this.visitorId,
      decidedAt: this.decidedAt,
      configuration: this.configuration,
      outcome: this.outcome,
      reason: this.reason,
      phase: this.phase,
      experiment: this.experiment,
      inference: this.inference,
      selection: this.selection,
      locale: this.locale,
      eventsInBatch: this.eventsInBatch,
      signalsIncomplete: this.signalsIncomplete,
      intervention: this.isIntervention() ? this.intervention : undefined,
    };
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
