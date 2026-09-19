// Commercial policy of a merchant (01-arquitectura-mvp.md §4.5; 03-alcance-mvp.md §4.8;
// ADR-027): the last authority and the only one that emits the verdict. It chooses among the
// candidates the quality gate accepted, walking the incentive ladder from the cheapest step,
// and it blocks what must not go out: no margin ⇒ nothing economic; the incentive within the
// ceiling and the ladder; no accelerating incentive under a high return risk; no discount to
// high intent; a budget per session, a cooldown and a fatigue limit per visitor. A policy only
// exists valid, is versioned (stamped on every decision) and its verdict is pure: the
// orchestrator brings the facts, the policy answers.
import { Vocabulary, type Condition, type FactContext } from "../barrier/index.js";
import {
  fail,
  MS_PER_SECOND,
  ok,
  type Arm,
  type Barrier,
  type Incentive,
  type Intervention,
  type NoOpReason,
  type Result,
} from "../shared-kernel/index.js";
import {
  InvalidCommercialVersion,
  InvalidCooldown,
  InvalidIncentiveCeiling,
  InvalidIncentiveLadder,
  InvalidInterventionBudget,
  InvalidMargin,
  InvalidReturnRisk,
  type CommercialError,
} from "./errors.js";
import type { Candidate, Judged, Step } from "../selection/index.js";

export type HighIntent = "from-cart" | "from-checkout" | "never";
export type Abandonment = "nothing" | "reassure-returns";

export interface CommercialPolicyRecord {
  version: string;
  maxIncentivePercent: number;
  incentiveLadderPercent: readonly number[];
  /** Absent: the merchant configured no margin, so nothing with an economic component goes out (01 §4.7). */
  marginPercent?: number;
  directIncentiveOnPrice: boolean;
  /** When it holds over the session, no accelerating incentive (01 §4.5). */
  returnRisk: Condition;
  highIntent: HighIntent;
  abandonment: Abandonment;
  interventionsPerSession: number;
  cooldownSeconds: number;
  interventionsPerVisitorPerDay: number;
}

/** What triggered the barrier the candidates are for. */
export type Trigger = "rules" | "abandonment" | "none";

export interface CommercialInput {
  /** Absent when the merchant has no active experiment. */
  arm?: Arm;
  barrier?: Barrier;
  trigger: Trigger;
  /** Why the barrier's evidence cannot sustain it, when it cannot (the decision policy's judgement). */
  evidenceReason?: NoOpReason;
  judged: readonly Judged[];
  abandoned: boolean;
  addedToCart: boolean;
  enteredCheckout: boolean;
  facts: FactContext;
  session: { interventions: number; lastInterventionAt?: Date };
  visitorInterventions: number;
  now: Date;
}

export type BlockReason = "margin-missing" | "incentive-not-allowed" | "return-risk";

export interface Blocked {
  candidateId: string;
  reason: BlockReason;
}

export type CommercialVerdict =
  | { kind: "intervene"; candidateId: string; barrier: Barrier; intervention: Intervention }
  | { kind: "no-op"; reason: NoOpReason; chosen?: string; blocked?: Blocked };

/** What the ladder walk settles on before the gates of arm, intent and budgets apply. */
type Choice =
  | { kind: "chosen"; candidate: Candidate; incentive?: Incentive }
  | { kind: "refused"; reason: NoOpReason; blocked?: Blocked };

const PERCENT_MAX = 100;
const INCENTIVE: Step = "incentive";
const REASSURANCE: Step = "reassurance";
const PRICE: Barrier = "price";
const RETURNS: Barrier = "returns";
const RETURN_RISK = "returnRisk";

const isPercent = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= PERCENT_MAX;
const isBudget = (value: number): boolean => Number.isInteger(value) && value >= 1;

export class CommercialPolicy {
  readonly version: string;
  readonly maxIncentivePercent: number;
  readonly incentiveLadderPercent: readonly number[];
  readonly marginPercent?: number;
  readonly directIncentiveOnPrice: boolean;
  readonly returnRisk: Condition;
  readonly highIntent: HighIntent;
  readonly abandonment: Abandonment;
  readonly interventionsPerSession: number;
  readonly cooldownSeconds: number;
  readonly interventionsPerVisitorPerDay: number;

  private constructor(record: CommercialPolicyRecord) {
    this.version = record.version;
    this.maxIncentivePercent = record.maxIncentivePercent;
    this.incentiveLadderPercent = record.incentiveLadderPercent;
    if (record.marginPercent !== undefined) this.marginPercent = record.marginPercent;
    this.directIncentiveOnPrice = record.directIncentiveOnPrice;
    this.returnRisk = record.returnRisk;
    this.highIntent = record.highIntent;
    this.abandonment = record.abandonment;
    this.interventionsPerSession = record.interventionsPerSession;
    this.cooldownSeconds = record.cooldownSeconds;
    this.interventionsPerVisitorPerDay = record.interventionsPerVisitorPerDay;
  }

  /**
   * A policy, or the first violated invariant: version not blank, ceiling an integer
   * percentage, ladder strictly increasing within 1..ceiling, margin absent or a percentage,
   * return-risk condition inside the vocabulary, budgets of at least one, cooldown not negative.
   */
  static of(record: CommercialPolicyRecord): Result<CommercialPolicy, CommercialError> {
    if (record.version.trim() === "") return fail(new InvalidCommercialVersion());
    if (!Number.isInteger(record.maxIncentivePercent) || !isPercent(record.maxIncentivePercent)) {
      return fail(new InvalidIncentiveCeiling());
    }
    const ladder = ladderOffence(record.incentiveLadderPercent, record.maxIncentivePercent);
    if (ladder !== undefined) return fail(new InvalidIncentiveLadder(ladder));
    if (record.marginPercent !== undefined && !isPercent(record.marginPercent))
      return fail(new InvalidMargin());
    const risk = Vocabulary.captured.check(record.returnRisk, RETURN_RISK);
    if (risk !== undefined) return fail(new InvalidReturnRisk(String(risk.details["path"]), risk.message));
    if (!isBudget(record.interventionsPerSession))
      return fail(new InvalidInterventionBudget("interventionsPerSession"));
    if (!isBudget(record.interventionsPerVisitorPerDay)) {
      return fail(new InvalidInterventionBudget("interventionsPerVisitorPerDay"));
    }
    if (!Number.isFinite(record.cooldownSeconds) || record.cooldownSeconds < 0)
      return fail(new InvalidCooldown());
    return ok(
      new CommercialPolicy({ ...record, incentiveLadderPercent: [...record.incentiveLadderPercent] }),
    );
  }

  /** A policy a store recorded: its invariants are not re-judged. */
  static rehydrate(record: CommercialPolicyRecord): CommercialPolicy {
    return new CommercialPolicy(record);
  }

  /** The barrier to select for: the inferred one, or the returns reassurance on an abandonment without a signal. */
  fallbackBarrier(barrier: Barrier | undefined, abandoned: boolean): Barrier | undefined {
    if (barrier !== undefined) return barrier;
    return abandoned && this.abandonment === "reassure-returns" ? RETURNS : undefined;
  }

  /**
   * The verdict, in a fixed order (01 §4.5): no experiment → CONTROL → high intent → session
   * budget or cooldown → visitor fatigue → the choice the ladder settled on. Every NO_OP keeps
   * what would have been chosen, so the ledger can tell.
   */
  verdict(input: CommercialInput): CommercialVerdict {
    const choice = this.#choose(input);
    const noOp = (reason: NoOpReason): CommercialVerdict => ({ kind: "no-op", reason, ...wouldHave(choice) });
    if (input.arm === undefined) return noOp("no-active-experiment");
    if (input.arm === "CONTROL") return noOp("control-arm");
    if (this.#highIntent(input)) return noOp("high-intent");
    if (this.#exhausted(input)) return noOp("session-budget-exhausted");
    if (input.visitorInterventions >= this.interventionsPerVisitorPerDay) return noOp("visitor-fatigue");
    if (choice.kind === "refused") return noOp(choice.reason);
    const intervention: Intervention = {
      anchor: choice.candidate.anchor,
      messageVersionId: choice.candidate.candidateId,
      ...(choice.incentive === undefined ? {} : { incentive: choice.incentive }),
    };
    return {
      kind: "intervene",
      candidateId: choice.candidate.candidateId,
      barrier: choice.candidate.barrier,
      intervention,
    };
  }

  /**
   * The ladder walk (03 §4.8): the incentive first when the barrier is price and the policy
   * lets it in directly; else the lowest acceptable step from where the walk starts, or the
   * lowest acceptable at all. A blocked incentive falls back to the lowest step without one.
   */
  #choose(input: CommercialInput): Choice {
    if (input.barrier === undefined) return { kind: "refused", reason: "barrier-unclear" };
    if (input.evidenceReason !== undefined) return { kind: "refused", reason: input.evidenceReason };
    const acceptable = input.judged.filter((j) => j.verdict.acceptable).map((j) => j.candidate);
    const start = startOf(input, acceptable);
    const lowest = (fits: (c: Candidate) => boolean): Candidate | undefined =>
      acceptable.find((c, i) => i >= start && fits(c)) ?? acceptable.find(fits);
    const candidate = this.#directIncentive(input.barrier, acceptable) ?? lowest(() => true);
    if (candidate === undefined) return { kind: "refused", reason: "no-acceptable-candidate" };
    if (candidate.step !== INCENTIVE) return { kind: "chosen", candidate };
    const reason = this.#economicBlock(input.facts);
    if (reason === undefined) {
      return { kind: "chosen", candidate, incentive: { kind: "percent", value: this.#incentiveValue() } };
    }
    const fallback = lowest((c) => c.step !== INCENTIVE);
    if (fallback !== undefined) return { kind: "chosen", candidate: fallback };
    return {
      kind: "refused",
      reason: "commercial-policy-blocked",
      blocked: { candidateId: candidate.candidateId, reason },
    };
  }

  /** The acceptable incentive when it enters directly (price barrier, policy allowing it). */
  #directIncentive(barrier: Barrier, acceptable: readonly Candidate[]): Candidate | undefined {
    if (barrier !== PRICE || !this.directIncentiveOnPrice) return undefined;
    return acceptable.find((c) => c.step === INCENTIVE);
  }

  /** Why an incentive cannot go out now, or undefined when it can. */
  #economicBlock(facts: FactContext): BlockReason | undefined {
    if (this.marginPercent === undefined) return "margin-missing";
    if (this.incentiveLadderPercent.length === 0) return "incentive-not-allowed";
    return facts.holds(this.returnRisk) ? "return-risk" : undefined;
  }

  /** The first step of the ladder; the invariant keeps it within the ceiling. */
  #incentiveValue(): number {
    return this.incentiveLadderPercent[0] ?? this.maxIncentivePercent;
  }

  #highIntent({ addedToCart, enteredCheckout }: CommercialInput): boolean {
    switch (this.highIntent) {
      case "from-checkout":
        return enteredCheckout;
      case "from-cart":
        return addedToCart || enteredCheckout;
      case "never":
        return false;
    }
  }

  #exhausted({ session, now }: CommercialInput): boolean {
    if (session.interventions >= this.interventionsPerSession) return true;
    if (session.lastInterventionAt === undefined) return false;
    return now.getTime() - session.lastInterventionAt.getTime() < this.cooldownSeconds * MS_PER_SECOND;
  }
}

/** What a NO_OP would have sent, or what blocked it, so the ledger can tell. */
function wouldHave(choice: Choice): { chosen?: string; blocked?: Blocked } {
  if (choice.kind === "chosen") return { chosen: choice.candidate.candidateId };
  return choice.blocked === undefined ? {} : { blocked: choice.blocked };
}

/**
 * Where the ladder walk starts among the acceptable candidates: at the reassurance when the
 * abandonment itself put the barrier on the table (03 §4.8), one step up when an abandonment
 * confirmed an inferred barrier (D-B), at the lowest otherwise.
 */
function startOf({ trigger, abandoned }: CommercialInput, acceptable: readonly Candidate[]): number {
  if (trigger === "abandonment")
    return Math.max(
      0,
      acceptable.findIndex((c) => c.step === REASSURANCE),
    );
  return abandoned ? 1 : 0;
}

/** The index of the first step of the ladder that is not an integer in 1..ceiling above the previous, or undefined. */
function ladderOffence(ladder: readonly number[], ceiling: number): number | undefined {
  let previous = 0;
  for (const [index, step] of ladder.entries()) {
    if (!Number.isInteger(step) || step <= previous || step > ceiling) return index;
    previous = step;
  }
  return undefined;
}
