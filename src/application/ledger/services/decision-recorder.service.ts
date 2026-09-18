// Application service: mints the identity of a decision and records it (ADR-021, ADR-023).
// Whoever decides (the decision plane) hands over the facts and the outcome; the ledger owns
// the id and the write. A ledger that cannot accept the record answers LedgerUnavailable and
// the caller degrades (the intervention is suppressed rather than left unmeasured).
import {
  InterveneDecision,
  NoOpDecision,
  type Decision,
  type DecisionFacts,
  type LedgerUnavailable,
} from "../../../domain/ledger/index.js";
import {
  fail,
  ok,
  type Intervention,
  type NoOpReason,
  type Result,
} from "../../../domain/shared-kernel/index.js";
import type { DecisionIdGenerator } from "../ports/decision-id-generator.js";
import type { DecisionLedger } from "../ports/decision-ledger.js";

export type DecisionOutcomeInput =
  { kind: "no-op"; reason: NoOpReason } | { kind: "intervene"; reason: string; intervention: Intervention };

export type DecisionFactsInput = Omit<DecisionFacts, "decisionId">;

export interface DecisionRecorder {
  record(
    facts: DecisionFactsInput,
    outcome: DecisionOutcomeInput,
  ): Promise<Result<Decision, LedgerUnavailable>>;
}

export interface DecisionRecorderDependencies {
  decisions: DecisionLedger;
  decisionIds: DecisionIdGenerator;
}

export class DefaultDecisionRecorder implements DecisionRecorder {
  readonly #deps: DecisionRecorderDependencies;

  constructor(deps: DecisionRecorderDependencies) {
    this.#deps = deps;
  }

  async record(
    facts: DecisionFactsInput,
    outcome: DecisionOutcomeInput,
  ): Promise<Result<Decision, LedgerUnavailable>> {
    const withId: DecisionFacts = { ...facts, decisionId: this.#deps.decisionIds.next() };
    const decision: Decision =
      outcome.kind === "no-op"
        ? NoOpDecision.of(withId, outcome.reason)
        : InterveneDecision.of(withId, outcome.reason, outcome.intervention);
    const written = await this.#deps.decisions.record(decision);
    return written.ok ? ok(decision) : fail(written.error);
  }
}
