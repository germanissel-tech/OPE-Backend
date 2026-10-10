// listConfigurationVersions (FR-012; ADR-031): every version the merchant published, newest
// first, paginated. Within the scope of the operator.
import { ok, type MerchantId, type Result } from "../../../domain/shared-kernel/index.js";
import { readEach, type Page, type PageQuery, type UseCase } from "../../shared-kernel/index.js";
import { readOfMerchant, type MerchantVersionRead } from "../services/version-restarts.js";
import type { MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { WindowRestartsService } from "../../experiment/index.js";
import type { ScopedMerchantService } from "../../merchant/index.js";
import type { ConfigurationStore } from "../ports/configuration-store.js";

export interface ListConfigurationVersionsRequest {
  actor: Operator;
  merchantId: MerchantId;
  page: PageQuery;
}

export type ListConfigurationVersionsResponse = Result<
  Page<MerchantVersionRead>,
  MerchantOutOfScope | MerchantNotFound
>;

export interface ListConfigurationVersionsDependencies {
  scoped: ScopedMerchantService;
  store: ConfigurationStore;
  /** What each version restarted, asked of the experiments (feature 042). */
  restarts: WindowRestartsService;
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
    const { store, restarts } = this.#deps;
    const page = await store.versionsOf(request.merchantId, request.page);
    return ok(await readEach(page, (version) => readOfMerchant(restarts, version)));
  }
}
