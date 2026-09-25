// listUnmappedAttributeValues (01 §3.1.1, feature 027): the attribute labels of a merchant OPE has
// no word for, most recent first, within the scope of the operator. What the merchant maps today is
// excluded here and not when the catalogue arrived, so mapping a value takes it off the report
// without republishing the catalogue.
import { ok, type MerchantId, type Result } from "../../../domain/shared-kernel/index.js";
import type { UnmappedAttributeValue } from "../../../domain/admin/index.js";
import type { MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { ScopedMerchantService } from "../../merchant/index.js";
import type { MessageDirectory } from "../../messages/index.js";
import type { Page, PageQuery, UseCase } from "../../shared-kernel/index.js";
import type { UnmappedValueLog } from "../ports/unmapped-value-log.js";

export interface ListUnmappedAttributeValuesRequest {
  actor: Operator;
  merchantId: MerchantId;
  page: PageQuery;
}

export type ListUnmappedAttributeValuesResponse = Result<
  Page<UnmappedAttributeValue>,
  MerchantOutOfScope | MerchantNotFound
>;

export interface ListUnmappedAttributeValuesDependencies {
  scoped: ScopedMerchantService;
  directory: MessageDirectory;
  unmapped: UnmappedValueLog;
}

export class ListUnmappedAttributeValuesUseCase implements UseCase<
  ListUnmappedAttributeValuesRequest,
  ListUnmappedAttributeValuesResponse
> {
  readonly #deps: ListUnmappedAttributeValuesDependencies;

  constructor(deps: ListUnmappedAttributeValuesDependencies) {
    this.#deps = deps;
  }

  async execute(request: ListUnmappedAttributeValuesRequest): Promise<ListUnmappedAttributeValuesResponse> {
    const found = await this.#deps.scoped.find(request.actor, request.merchantId);
    if (!found.ok) return found;
    const { labels } = await this.#deps.directory.settingsFor(request.merchantId);
    return ok(await this.#deps.unmapped.pendingOf(request.merchantId, labels.labels(), request.page));
  }
}
