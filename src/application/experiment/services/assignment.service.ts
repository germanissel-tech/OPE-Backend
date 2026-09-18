// Application service: the arm of a visitor in the merchant's active experiment (constitution
// III; ADR-022). Shared by whoever orchestrates a batch, so it is a service, not a use case
// (ADR-023). Deterministic (assignArm) and stable: an assignment already recorded wins over the
// computed one, and the disagreement — only possible after an improper configuration change —
// is logged as an operational error without the visitor. Recorded the first time it is resolved.
import { assignArm, type Assignment } from "../../../domain/experiment/index.js";
import {
  fail,
  ok,
  type MerchantId,
  type Result,
  type VisitorId,
} from "../../../domain/shared-kernel/index.js";
import type { LedgerUnavailable } from "../../../domain/ledger/index.js";
import type { Clock, Logger } from "../../shared-kernel/index.js";
import type { AssignmentLedger } from "../ports/assignment-ledger.js";
import type { ExperimentDirectory } from "../ports/experiment-directory.js";

/** `undefined` when the merchant has no active experiment. */
export type AssignmentResult = Result<Assignment | undefined, LedgerUnavailable>;

export interface AssignmentService {
  assign(merchantId: MerchantId, visitorId: VisitorId): Promise<AssignmentResult>;
}

export interface AssignmentServiceDependencies {
  experiments: ExperimentDirectory;
  assignments: AssignmentLedger;
  clock: Clock;
  logger: Logger;
}

export class DefaultAssignmentService implements AssignmentService {
  readonly #deps: AssignmentServiceDependencies;

  constructor(deps: AssignmentServiceDependencies) {
    this.#deps = deps;
  }

  async assign(merchantId: MerchantId, visitorId: VisitorId): Promise<AssignmentResult> {
    const { experiments, assignments, clock, logger } = this.#deps;
    const experiment = experiments.activeFor(merchantId);
    if (!experiment) return ok(undefined);
    const arm = assignArm(experiment, visitorId);
    const recorded = await assignments.find(merchantId, experiment.experimentId, visitorId);
    if (recorded) {
      if (recorded.arm !== arm) {
        logger.error(
          { merchantId, experimentId: experiment.experimentId, recorded: recorded.arm, computed: arm },
          "assignment-drift: the recorded arm wins; seed or split of an existing experiment changed",
        );
      }
      return ok(recorded);
    }
    const assignment: Assignment = {
      merchantId,
      experimentId: experiment.experimentId,
      visitorId,
      arm,
      assignedAt: clock.now(),
    };
    const written = await assignments.record(assignment);
    return written.ok ? ok(assignment) : fail(written.error);
  }
}
