// Assignment (constitution III; ADR-022): the recorded fact that a visitor got an arm in an
// experiment. A value without rules of its own: the Experiment decides the arm.
import type { Arm, ExperimentId, MerchantId, VisitorId } from "../shared-kernel/index.js";

export interface Assignment {
  merchantId: MerchantId;
  experimentId: ExperimentId;
  visitorId: VisitorId;
  arm: Arm;
  assignedAt: Date;
}
