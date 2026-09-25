// listUnmappedAttributeValues (01 §3.1.1, feature 027): path + paging → use case → 200 with the page.
import { merchantPageResponse } from "../../http/boundary.js";
import { unmappedAttributeValueDto } from "../presenters.js";
import type {
  ListUnmappedAttributeValuesRequest,
  ListUnmappedAttributeValuesResponse,
} from "../../../application/admin/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeListUnmappedAttributeValues(
  listUnmappedAttributeValues: UseCase<
    ListUnmappedAttributeValuesRequest,
    ListUnmappedAttributeValuesResponse
  >,
): OperationHandler<"listUnmappedAttributeValues"> {
  return (req) => merchantPageResponse(req, listUnmappedAttributeValues, unmappedAttributeValueDto);
}
