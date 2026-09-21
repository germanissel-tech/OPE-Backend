// getSdkConfig (01 §3.1.1, §14.2; constitution XI): what the SDK of the merchant of the
// credential needs to run — the kill switch as the merchant is now, and what of the effective
// configuration it may see. The merchant arrives resolved by the security handler.
import type { Merchant } from "../../../domain/merchant/index.js";
import type { UseCase } from "../../shared-kernel/index.js";
import type { SdkConfigurationSource, SdkConfigurationView } from "../ports/sdk-configuration-source.js";

export interface GetSdkConfigRequest {
  merchant: Merchant;
}

export interface SdkConfig extends SdkConfigurationView {
  enabled: boolean;
}

export interface GetSdkConfigDependencies {
  configuration: SdkConfigurationSource;
}

export class GetSdkConfigUseCase implements UseCase<GetSdkConfigRequest, SdkConfig> {
  readonly #deps: GetSdkConfigDependencies;

  constructor(deps: GetSdkConfigDependencies) {
    this.#deps = deps;
  }

  async execute(request: GetSdkConfigRequest): Promise<SdkConfig> {
    const view = await this.#deps.configuration.sdkConfigurationFor(request.merchant.merchantId);
    return { enabled: request.merchant.isOn(), ...view };
  }
}
