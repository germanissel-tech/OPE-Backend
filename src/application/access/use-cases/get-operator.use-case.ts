// Who the authenticated operator is (ADR-044). There is no rule to apply: the security handler
// already resolved the token into the operator, and that operator is the answer. It is a use case
// all the same because every served operation goes through one (ADR-023): that is what gives it
// the log and, when it applies, the audit, like any other.
import type { Operator } from "../../../domain/operator/index.js";
import type { UseCase } from "../../shared-kernel/index.js";

export interface GetOperatorRequest {
  actor: Operator;
}

/** Answering who you are cannot fail as a business outcome, so the operator comes directly (ADR-023). */
export type GetOperatorResponse = Operator;

export class GetOperatorUseCase implements UseCase<GetOperatorRequest, GetOperatorResponse> {
  execute(request: GetOperatorRequest): Promise<GetOperatorResponse> {
    return Promise.resolve(request.actor);
  }
}
