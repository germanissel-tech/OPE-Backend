// getPlatformConfiguration (constitution XI; ADR-031): level 1 as the release declares it.
// Any operator; nothing to fail.
import type { PlatformConfiguration } from "../../../domain/configuration/index.js";
import type { Operator } from "../../../domain/operator/index.js";
import type { UseCase } from "../../shared-kernel/index.js";
import type { ConfigurationService } from "../services/configuration.service.js";

export interface GetPlatformConfigurationRequest {
  actor: Operator;
}

export interface GetPlatformConfigurationDependencies {
  configuration: ConfigurationService;
}

export class GetPlatformConfigurationUseCase implements UseCase<
  GetPlatformConfigurationRequest,
  PlatformConfiguration
> {
  readonly #deps: GetPlatformConfigurationDependencies;

  constructor(deps: GetPlatformConfigurationDependencies) {
    this.#deps = deps;
  }

  execute(): Promise<PlatformConfiguration> {
    return this.#deps.configuration.platform();
  }
}
