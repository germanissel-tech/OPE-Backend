// rotatePlatformKey (ADR-014, ADR-029, ADR-031): the rotation of the platform credential; the response is built at the boundary.
import { rotationResponse } from "../presenters.js";
import type { RotateCredentialRequest, RotateCredentialResult } from "../../../application/merchant/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeRotatePlatformKey(
  rotateCredential: UseCase<RotateCredentialRequest, RotateCredentialResult>,
): OperationHandler<"rotatePlatformKey"> {
  return (req) => rotationResponse(req, "platform", rotateCredential);
}
