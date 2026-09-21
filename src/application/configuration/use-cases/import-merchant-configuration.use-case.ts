// importMerchantConfiguration (ADR-031): the configuration the seed declares for a merchant
// becomes its version 1, as the system operator, only when the merchant never published one —
// like the merchants themselves, the seed enters an empty store and never overwrites. The seed
// is the origin, so no experiment freezes it; what it declares is judged like any version.
import {
  MerchantConfigurationVersion,
  type DeclaredConfiguration,
  type VersionError,
} from "../../../domain/configuration/index.js";
import {
  fail,
  ok,
  type MerchantId,
  type Result,
  type StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import type { Operator } from "../../../domain/operator/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { ConfigurationStore } from "../ports/configuration-store.js";
import type { ConfigurationService } from "../services/configuration.service.js";

export interface ImportMerchantConfigurationRequest {
  actor: Operator;
  merchantId: MerchantId;
  declared: DeclaredConfiguration;
}

export type ImportMerchantConfigurationResponse = Result<
  { version: MerchantConfigurationVersion } | { skipped: true },
  VersionError | StoreUnavailable
>;

export interface ImportMerchantConfigurationDependencies {
  store: ConfigurationStore;
  configuration: ConfigurationService;
  clock: Clock;
}

export class ImportMerchantConfigurationUseCase implements UseCase<
  ImportMerchantConfigurationRequest,
  ImportMerchantConfigurationResponse
> {
  readonly #deps: ImportMerchantConfigurationDependencies;

  constructor(deps: ImportMerchantConfigurationDependencies) {
    this.#deps = deps;
  }

  async execute(request: ImportMerchantConfigurationRequest): Promise<ImportMerchantConfigurationResponse> {
    const { store, configuration, clock } = this.#deps;
    if ((await store.latestOf(request.merchantId)) !== undefined) return ok({ skipped: true });
    const draft = MerchantConfigurationVersion.draft({
      merchantId: request.merchantId,
      declared: request.declared,
      corrective: false,
      publishedAt: clock.now(),
      operatorId: request.actor.operatorId,
    });
    if (!draft.ok) return fail(draft.error);
    const judged = await configuration.judge(draft.value);
    if (!judged.ok) return fail(judged.error);
    const published = await store.publish(draft.value);
    if (!published.ok) return fail(published.error);
    await configuration.apply(published.value);
    return ok({ version: published.value });
  }
}
