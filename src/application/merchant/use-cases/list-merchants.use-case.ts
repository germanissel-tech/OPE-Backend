// listMerchants (ADR-031): the merchants an operator may see — every one for a global scope,
// only the listed ones otherwise — oldest first, paginated.
import type { Merchant } from "../../../domain/merchant/index.js";
import type { Operator } from "../../../domain/operator/index.js";
import type { Page, PageQuery, UseCase } from "../../shared-kernel/index.js";
import type { MerchantStore } from "../ports/merchant-store.js";

export interface ListMerchantsRequest extends PageQuery {
  actor: Operator;
}

export type ListMerchantsResponse = Page<Merchant>;

export interface ListMerchantsDependencies {
  merchants: MerchantStore;
}

export class ListMerchantsUseCase implements UseCase<ListMerchantsRequest, ListMerchantsResponse> {
  readonly #deps: ListMerchantsDependencies;

  constructor(deps: ListMerchantsDependencies) {
    this.#deps = deps;
  }

  async execute(request: ListMerchantsRequest): Promise<ListMerchantsResponse> {
    const page = await this.#deps.merchants.list({ cursor: request.cursor, limit: request.limit });
    return { ...page, items: page.items.filter((m) => request.actor.scopeFor(m.merchantId).ok) };
  }
}
