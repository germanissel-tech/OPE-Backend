// rotateIngestKey (ADR-014, ADR-029, ADR-031): the rotation of the ingest credential; the response is built at the boundary.
import { rotationResponse } from "../../admin-boundary.js";
import type {
  RotateCredentialRequest,
  RotateCredentialResult,
} from "../../../../application/merchant/index.js";
import type { UseCase } from "../../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../typed.js";

export function makeRotateIngestKey(
  rotateCredential: UseCase<RotateCredentialRequest, RotateCredentialResult>,
): OperationHandler<"rotateIngestKey"> {
  return (req) => rotationResponse(req, "ingest", rotateCredential);
}
