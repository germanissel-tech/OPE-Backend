// getMerchantConfigurationVersion (feature 042): one version of a merchant's configuration by its number, the
// same one its page of the history carries, with what it restarted. Within the operator's scope: outside it the
// answer is the same whether the version exists or not, so it reveals neither.
import { ConfigurationVersionNotFound } from "../../../domain/configuration/index.js";
import { fail, ok, type MerchantId, type Result } from "../../../domain/shared-kernel/index.js";
import { readOfMerchant, type MerchantVersionRead } from "../services/version-restarts.js";
import type { MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { WindowRestartsService } from "../../experiment/index.js";
import type { ScopedMerchantService } from "../../merchant/index.js";
import type { UseCase } from "../../shared-kernel/index.js";
import type { ConfigurationStore } from "../ports/configuration-store.js";

export interface GetMerchantConfigurationVersionRequest {
  actor: Operator;
  merchantId: MerchantId;
  version: number;
}

export type GetMerchantConfigurationVersionResponse = Result<
  MerchantVersionRead,
  MerchantOutOfScope | MerchantNotFound | ConfigurationVersionNotFound
>;

export interface GetMerchantConfigurationVersionDependencies {
  scoped: ScopedMerchantService;
  store: ConfigurationStore;
  restarts: WindowRestartsService;
}

export class GetMerchantConfigurationVersionUseCase implements UseCase<
  GetMerchantConfigurationVersionRequest,
  GetMerchantConfigurationVersionResponse
> {
  readonly #deps: GetMerchantConfigurationVersionDependencies;

  constructor(deps: GetMerchantConfigurationVersionDependencies) {
    this.#deps = deps;
  }

  async execute(
    request: GetMerchantConfigurationVersionRequest,
  ): Promise<GetMerchantConfigurationVersionResponse> {
    const { scoped, store, restarts } = this.#deps;
    const found = await scoped.find(request.actor, request.merchantId);
    if (!found.ok) return found;
    const version = await store.versionOf(request.merchantId, request.version);
    // Nothing is ever deleted from a merchant's history, so a missing number means it was never published.
    if (version === undefined) return fail(new ConfigurationVersionNotFound("merchant", request.version));
    return ok(await readOfMerchant(restarts, version));
  }
}
