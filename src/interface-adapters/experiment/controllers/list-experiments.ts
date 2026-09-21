// listExperiments (ADR-031): path + paging → use case → 200 with the page.
import { merchantPageResponse } from "../../http/boundary.js";
import { experimentDto } from "../presenters.js";
import type {
  ListExperimentsRequest,
  ListExperimentsResponse,
} from "../../../application/experiment/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeListExperiments(
  listExperiments: UseCase<ListExperimentsRequest, ListExperimentsResponse>,
): OperationHandler<"listExperiments"> {
  return (req) => merchantPageResponse(req, listExperiments, experimentDto);
}
