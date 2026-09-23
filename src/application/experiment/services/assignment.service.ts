// Application service: the arm of a visitor in the open experiment of the merchant (constitution
// III; ADR-022), with the phase of the experiment at that moment (03 §4.10). Shared by whoever orchestrates a batch, so it is a service, not a use case
// (ADR-023). Deterministic (`Experiment.assign`) and stable: an assignment already recorded wins over the
// computed one, and the disagreement — only possible after an improper configuration change —
// is logged as an operational error without the visitor. Recorded the first time it is resolved.
import {
  fail,
  ok,
  type MerchantId,
  type Result,
  type VisitorId,
} from "../../../domain/shared-kernel/index.js";
import type { Assignment, ExperimentPhase } from "../../../domain/experiment/index.js";
import type { LedgerUnavailable } from "../../../domain/ledger/index.js";
import type { Clock, Logger } from "../../shared-kernel/index.js";
import type { AssignmentLedger } from "../ports/assignment-ledger.js";
import type { ExperimentDirectory } from "../ports/experiment-directory.js";

/** The assignment of the visitor and what a decision taken now is for. */
export interface VisitorAssignment {
  assignment: Assignment;
  phase: ExperimentPhase;
}

/** `undefined` when the merchant has no open experiment. */
export type AssignmentResult = Result<VisitorAssignment | undefined, LedgerUnavailable>;

export interface AssignmentService {
  assign(merchantId: MerchantId, visitorId: VisitorId): Promise<AssignmentResult>;
}

export interface AssignmentServiceDependencies {
  experiments: ExperimentDirectory;
  assignments: AssignmentLedger;
  clock: Clock;
  logger: Logger;
}

export class Assignments implements AssignmentService {
  readonly #deps: AssignmentServiceDependencies;

  constructor(deps: AssignmentServiceDependencies) {
    this.#deps = deps;
  }

  async assign(merchantId: MerchantId, visitorId: VisitorId): Promise<AssignmentResult> {
    const { experiments, assignments, clock, logger } = this.#deps;
    const experiment = await experiments.activeFor(merchantId);
    if (!experiment) return ok(undefined);
    const phase = experiment.phase();
    const arm = experiment.assign(visitorId);
    const recorded = await assignments.find(merchantId, experiment.experimentId, visitorId);
    if (recorded) {
      if (recorded.arm !== arm) {
        logger.error(
          { merchantId, experimentId: experiment.experimentId, recorded: recorded.arm, computed: arm },
          "assignment-drift: the recorded arm wins; seed or split of an existing experiment changed",
        );
      }
      return ok({ assignment: recorded, phase });
    }
    const assignment: Assignment = {
      merchantId,
      experimentId: experiment.experimentId,
      visitorId,
      arm,
      assignedAt: clock.now(),
    };
    const written = await assignments.record(assignment);
    return written.ok ? ok({ assignment, phase }) : fail(written.error);
  }
}
