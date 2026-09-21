// setKillSwitch (01 §14.2, ADR-031): body → use case → 200 with the switch as it is now.
import { merchantIdOf } from "../../http/boundary.js";
import { operatorOf } from "../../http/security/principal.js";
import { HTTP_STATUS } from "../../http/status.js";
import { toProblem } from "../../http/to-problem.js";
import type { SetKillSwitchRequest, SetKillSwitchResponse } from "../../../application/merchant/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeSetKillSwitch(
  setKillSwitch: UseCase<SetKillSwitchRequest, SetKillSwitchResponse>,
): OperationHandler<"setKillSwitch"> {
  return async (req) => {
    const result = await setKillSwitch.execute({
      actor: operatorOf(req),
      merchantId: merchantIdOf(req.path),
      enabled: req.body.enabled,
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    return { status: HTTP_STATUS.OK, body: { enabled: result.value.isOn() } };
  };
}
