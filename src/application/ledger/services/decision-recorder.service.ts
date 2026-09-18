// Application service: mints the identity of a decision and records it (ADR-021, ADR-023).
// Whoever decides (the decision plane) hands over the facts and the outcome; the ledger owns
// the id and the write. When the ledger cannot accept the record, the decision degrades to
// NO_OP `ledger-unavailable` without being recorded — the intervention is suppressed rather
// than left unmeasured (01 §4.7) — and the operational error is logged without the visitor.
import {
  InterveneDecision,
  NoOpDecision,
  type Decision,
  type DecisionFacts,
} from "../../../domain/ledger/index.js";
import type { Intervention, NoOpReason } from "../../../domain/shared-kernel/index.js";
import type { Logger } from "../../shared-kernel/index.js";
import type { DecisionIdGenerator } from "../ports/decision-id-generator.js";
import type { DecisionLedger } from "../ports/decision-ledger.js";

export type DecisionOutcomeInput =
  { kind: "no-op"; reason: NoOpReason } | { kind: "intervene"; reason: string; intervention: Intervention };

export type DecisionFactsInput = Omit<DecisionFacts, "decisionId">;

export interface DecisionRecorder {
  /** The decision as recorded, or degraded to NO_OP `ledger-unavailable` when the ledger could not accept it. */
  record(facts: DecisionFactsInput, outcome: DecisionOutcomeInput): Promise<Decision>;
  /** A decision that never reached the ledger because the ledger was already unavailable (`why` is logged). */
  unrecorded(facts: DecisionFactsInput, why: string): Decision;
}

export interface DecisionRecorderDependencies {
  decisions: DecisionLedger;
  decisionIds: DecisionIdGenerator;
  logger: Logger;
}

const LEDGER_UNAVAILABLE: NoOpReason = "ledger-unavailable";

export class DefaultDecisionRecorder implements DecisionRecorder {
  readonly #deps: DecisionRecorderDependencies;

  constructor(deps: DecisionRecorderDependencies) {
    this.#deps = deps;
  }

  async record(facts: DecisionFactsInput, outcome: DecisionOutcomeInput): Promise<Decision> {
    const withId: DecisionFacts = { ...facts, decisionId: this.#deps.decisionIds.next() };
    const decision: Decision =
      outcome.kind === "no-op"
        ? NoOpDecision.of(withId, outcome.reason)
        : InterveneDecision.of(withId, outcome.reason, outcome.intervention);
    const written = await this.#deps.decisions.record(decision);
    return written.ok ? decision : this.#degrade(withId, "decision not recorded");
  }

  unrecorded(facts: DecisionFactsInput, why: string): Decision {
    return this.#degrade({ ...facts, decisionId: this.#deps.decisionIds.next() }, why);
  }

  #degrade(facts: DecisionFacts, why: string): Decision {
    this.#deps.logger.error(
      { merchantId: facts.merchantId, decisionId: facts.decisionId },
      `${why}: ${LEDGER_UNAVAILABLE}`,
    );
    return NoOpDecision.of(facts, LEDGER_UNAVAILABLE);
  }
}
