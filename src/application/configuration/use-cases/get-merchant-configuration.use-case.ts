// getMerchantConfiguration (01 §14.2; ADR-031): what the merchant is served with — the
// effective values, what the version in force declared, and the three versions every decision
// stamps. Within the scope of the operator.
import { ok, type MerchantId, type Result } from "../../../domain/shared-kernel/index.js";
import type { DeclaredConfiguration, EffectiveConfiguration } from "../../../domain/configuration/index.js";
import type { MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { ScopedMerchantService } from "../../merchant/index.js";
import type { UseCase } from "../../shared-kernel/index.js";
import type { ConfigurationStore } from "../ports/configuration-store.js";
import type { ConfigurationService } from "../services/configuration.service.js";

export interface GetMerchantConfigurationRequest {
  actor: Operator;
  merchantId: MerchantId;
}

export interface MerchantConfigurationView {
  effective: EffectiveConfiguration;
  declared: DeclaredConfiguration;
}

export type GetMerchantConfigurationResponse = Result<
  MerchantConfigurationView,
  MerchantOutOfScope | MerchantNotFound
>;

export interface GetMerchantConfigurationDependencies {
  scoped: ScopedMerchantService;
  store: ConfigurationStore;
  configuration: ConfigurationService;
}

export class GetMerchantConfigurationUseCase implements UseCase<
  GetMerchantConfigurationRequest,
  GetMerchantConfigurationResponse
> {
  readonly #deps: GetMerchantConfigurationDependencies;

  constructor(deps: GetMerchantConfigurationDependencies) {
    this.#deps = deps;
  }

  async execute(request: GetMerchantConfigurationRequest): Promise<GetMerchantConfigurationResponse> {
    const found = await this.#deps.scoped.find(request.actor, request.merchantId);
    if (!found.ok) return found;
    const [effective, latest] = await Promise.all([
      this.#deps.configuration.effectiveFor(request.merchantId),
      this.#deps.store.latestOf(request.merchantId),
    ]);
    return ok({ effective, declared: latest?.declared ?? {} });
  }
}
