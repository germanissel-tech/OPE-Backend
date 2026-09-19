// Correlation (01 §5, 02 §5.2, ADR-028): the verifiable link between an order and an OPE
// session, established only by mechanism A — the platform sent the session the storefront
// attached to the order, and the merchant's ledger knows that session (it decided in it).
// Nothing is inferred: without decisions there is no correlation. The incentive redemption
// crosses what the platform says it applied with what the session's decisions granted.
import type { Decision, DecisionExperiment, DecisionId } from "../ledger/index.js";
import type { Incentive, SessionId, VisitorId } from "../shared-kernel/index.js";

export interface CorrelationRecord {
  sessionId: SessionId;
  visitorId: VisitorId;
  /** The experiment and arm the session decided under; absent when the merchant had none. */
  experiment?: DecisionExperiment | undefined;
}

export class Correlation implements CorrelationRecord {
  readonly sessionId: SessionId;
  readonly visitorId: VisitorId;
  readonly experiment?: DecisionExperiment;

  private constructor(record: CorrelationRecord) {
    this.sessionId = record.sessionId;
    this.visitorId = record.visitorId;
    if (record.experiment !== undefined) this.experiment = record.experiment;
  }

  /**
   * The correlation the session's decisions sustain: none without decisions (the session is
   * unknown to this merchant); else the visitor of the session and the experiment of the last
   * decision that had one.
   */
  static of(sessionId: SessionId, decisions: readonly Decision[]): Correlation | undefined {
    const [first] = decisions;
    if (first === undefined) return undefined;
    const experiment = [...decisions].reverse().find((d) => d.experiment !== undefined)?.experiment;
    return new Correlation({ sessionId, visitorId: first.visitorId, experiment });
  }

  static rehydrate(record: CorrelationRecord): Correlation {
    return new Correlation(record);
  }
}

export const REDEMPTION_VERDICTS = [
  "matched",
  "mismatched",
  "not-applied",
  "not-granted",
  "unverifiable",
] as const;
export type RedemptionVerdict = (typeof REDEMPTION_VERDICTS)[number];

/** An incentive a decision of the session granted. */
export interface Granted {
  decisionId: DecisionId;
  incentive: Incentive;
}

export interface IncentiveRedemptionRecord {
  verdict: RedemptionVerdict;
  /** What the platform says it applied at the checkout. */
  declared?: Incentive;
  /** What the last intervention of the session granted. */
  granted?: Granted;
}

export class IncentiveRedemption implements IncentiveRedemptionRecord {
  readonly verdict: RedemptionVerdict;
  readonly declared?: Incentive;
  readonly granted?: Granted;

  private constructor(record: IncentiveRedemptionRecord) {
    this.verdict = record.verdict;
    if (record.declared !== undefined) this.declared = record.declared;
    if (record.granted !== undefined) this.granted = record.granted;
  }

  /**
   * The crossing of what the platform declared with what the correlated session granted (the
   * last intervention carrying an incentive). Nothing declared and nothing granted: no
   * redemption at all. Declared without a correlation: unverifiable.
   */
  static of(
    declared: Incentive | undefined,
    correlated: boolean,
    decisions: readonly Decision[],
  ): IncentiveRedemption | undefined {
    const granted = lastGranted(decisions);
    if (declared === undefined) {
      return granted === undefined ? undefined : new IncentiveRedemption({ verdict: "not-applied", granted });
    }
    if (!correlated) return new IncentiveRedemption({ verdict: "unverifiable", declared });
    if (granted === undefined) return new IncentiveRedemption({ verdict: "not-granted", declared });
    // Only one incentive kind exists in the MVP: the value is the whole comparison.
    const same = granted.incentive.value === declared.value;
    return new IncentiveRedemption({ verdict: same ? "matched" : "mismatched", declared, granted });
  }

  static rehydrate(record: IncentiveRedemptionRecord): IncentiveRedemption {
    return new IncentiveRedemption(record);
  }
}

/** The incentive of the last intervention of the session that carried one. */
function lastGranted(decisions: readonly Decision[]): Granted | undefined {
  for (const decision of [...decisions].reverse()) {
    if (decision.isIntervention() && decision.intervention.incentive !== undefined) {
      return { decisionId: decision.decisionId, incentive: decision.intervention.incentive };
    }
  }
  return undefined;
}
