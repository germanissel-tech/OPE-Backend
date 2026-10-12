// rotateNoticeKey (feature 044, research R-06): the rotation of the notice credential; the response is built at the boundary.
import { rotationResponse } from "../presenters.js";
import type { RotateCredentialRequest, RotateCredentialResult } from "../../../application/merchant/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeRotateNoticeKey(
  rotateCredential: UseCase<RotateCredentialRequest, RotateCredentialResult>,
): OperationHandler<"rotateNoticeKey"> {
  return (req) => rotationResponse(req, "notice", rotateCredential);
}
