// listConfigurationVersions (FR-012; ADR-031): every version the merchant published, newest
// first, paginated. Within the scope of the operator.
import { ok, type MerchantId, type Result } from "../../../domain/shared-kernel/index.js";
import type { MerchantConfigurationVersion } from "../../../domain/configuration/index.js";
import type { MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { ScopedMerchantService } from "../../merchant/index.js";
import type { Page, PageQuery, UseCase } from "../../shared-kernel/index.js";
import type { ConfigurationStore } from "../ports/configuration-store.js";

export interface ListConfigurationVersionsRequest {
  actor: Operator;
  merchantId: MerchantId;
  page: PageQuery;
}

export type ListConfigurationVersionsResponse = Result<
  Page<MerchantConfigurationVersion>,
  MerchantOutOfScope | MerchantNotFound
>;

export interface ListConfigurationVersionsDependencies {
  scoped: ScopedMerchantService;
  store: ConfigurationStore;
}

export class ListConfigurationVersionsUseCase implements UseCase<
  ListConfigurationVersionsRequest,
  ListConfigurationVersionsResponse
> {
  readonly #deps: ListConfigurationVersionsDependencies;

  constructor(deps: ListConfigurationVersionsDependencies) {
    this.#deps = deps;
  }

  async execute(request: ListConfigurationVersionsRequest): Promise<ListConfigurationVersionsResponse> {
    const found = await this.#deps.scoped.find(request.actor, request.merchantId);
    if (!found.ok) return found;
    return ok(await this.#deps.store.versionsOf(request.merchantId, request.page));
  }
}
