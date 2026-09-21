// rotatePlatformSecret (ADR-014, ADR-029, ADR-031): the rotation of the signing credential; the response is built at the boundary.
import { rotationResponse } from "../../admin-boundary.js";
import type {
  RotateCredentialRequest,
  RotateCredentialResult,
} from "../../../../application/merchant/index.js";
import type { UseCase } from "../../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../typed.js";

export function makeRotatePlatformSecret(
  rotateCredential: UseCase<RotateCredentialRequest, RotateCredentialResult>,
): OperationHandler<"rotatePlatformSecret"> {
  return (req) => rotationResponse(req, "signing", rotateCredential);
}
