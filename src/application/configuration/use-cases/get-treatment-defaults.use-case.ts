// getTreatmentDefaults (constitution XI; ADR-031): level 2 as the release declares it. Any
// operator; nothing to fail.
import type { TreatmentDefaults } from "../../../domain/configuration/index.js";
import type { Operator } from "../../../domain/operator/index.js";
import type { UseCase } from "../../shared-kernel/index.js";
import type { ConfigurationService } from "../services/configuration.service.js";

export interface GetTreatmentDefaultsRequest {
  actor: Operator;
}

export interface GetTreatmentDefaultsDependencies {
  configuration: ConfigurationService;
}

export class GetTreatmentDefaultsUseCase implements UseCase<GetTreatmentDefaultsRequest, TreatmentDefaults> {
  readonly #deps: GetTreatmentDefaultsDependencies;

  constructor(deps: GetTreatmentDefaultsDependencies) {
    this.#deps = deps;
  }

  execute(): Promise<TreatmentDefaults> {
    return this.#deps.configuration.defaults();
  }
}
