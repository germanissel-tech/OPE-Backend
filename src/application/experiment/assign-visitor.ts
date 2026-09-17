// Use case: the arm of a visitor in the merchant's active experiment (constitution III; ADR-022).
// Deterministic (assignArm) and stable: an assignment already recorded wins over the computed
// one, and the disagreement — only possible after an improper configuration change — is logged
// as an operational error without the visitor. Recorded the first time it is resolved.
import { assignArm, type Assignment } from "../../domain/experiment/index.js";
import type { MerchantId, VisitorId } from "../../domain/shared-kernel/index.js";
import type { Clock, Logger } from "../shared-kernel/index.js";
import type { AssignmentLedger } from "./ports/assignment-ledger.js";
import type { ExperimentDirectory } from "./ports/experiment-directory.js";

export interface AssignVisitorInput {
  merchantId: MerchantId;
  visitorId: VisitorId;
}

export type AssignVisitorResult =
  /** `assignment` is undefined when the merchant has no active experiment. */
  { ok: true; assignment: Assignment | undefined } | { ok: false; reason: "ledger-unavailable" };

export type AssignVisitor = (input: AssignVisitorInput) => Promise<AssignVisitorResult>;

export interface AssignVisitorDeps {
  experiments: ExperimentDirectory;
  assignments: AssignmentLedger;
  clock: Clock;
  logger: Logger;
}

export function makeAssignVisitor({
  experiments,
  assignments,
  clock,
  logger,
}: AssignVisitorDeps): AssignVisitor {
  return async ({ merchantId, visitorId }) => {
    const experiment = experiments.activeFor(merchantId);
    if (!experiment) return { ok: true, assignment: undefined };
    const arm = assignArm(experiment, visitorId);
    const recorded = await assignments.find(merchantId, experiment.experimentId, visitorId);
    if (recorded) {
      if (recorded.arm !== arm) {
        logger.error(
          { merchantId, experimentId: experiment.experimentId, recorded: recorded.arm, computed: arm },
          "assignment-drift: the recorded arm wins; seed or split of an existing experiment changed",
        );
      }
      return { ok: true, assignment: recorded };
    }
    const assignment: Assignment = {
      merchantId,
      experimentId: experiment.experimentId,
      visitorId,
      arm,
      assignedAt: clock.now(),
    };
    if ((await assignments.record(assignment)) === "unavailable")
      return { ok: false, reason: "ledger-unavailable" };
    return { ok: true, assignment };
  };
}
