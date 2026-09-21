// publishMerchantConfiguration (01 §14.2; 03 §4.10; constitution XI; ADR-031): the next
// version of a merchant's configuration. Within the operator's scope; identical to the version
// in force it repeats it (ADR-020); while an experiment is active only a corrective version,
// with its reason, is accepted; the draft is judged by its own rules and by the resolution over
// the levels in force; the store numbers it; it is served from that instant.
import {
  ConfigurationFrozen,
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
import type { MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { ExperimentDirectory } from "../../experiment/index.js";
import type { ScopedMerchantService } from "../../merchant/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { ConfigurationStore } from "../ports/configuration-store.js";
import type { ConfigurationService } from "../services/configuration.service.js";

export interface PublishMerchantConfigurationRequest {
  actor: Operator;
  merchantId: MerchantId;
  declared: DeclaredConfiguration;
  corrective: boolean;
  reason?: string | undefined;
}

export interface PublishedConfiguration {
  version: MerchantConfigurationVersion;
  outcome: "created" | "repeated";
}

export type PublishMerchantConfigurationResponse = Result<
  PublishedConfiguration,
  MerchantOutOfScope | MerchantNotFound | ConfigurationFrozen | VersionError | StoreUnavailable
>;

export interface PublishMerchantConfigurationDependencies {
  scoped: ScopedMerchantService;
  store: ConfigurationStore;
  configuration: ConfigurationService;
  experiments: ExperimentDirectory;
  clock: Clock;
}

export class PublishMerchantConfigurationUseCase implements UseCase<
  PublishMerchantConfigurationRequest,
  PublishMerchantConfigurationResponse
> {
  readonly #deps: PublishMerchantConfigurationDependencies;

  constructor(deps: PublishMerchantConfigurationDependencies) {
    this.#deps = deps;
  }

  async execute(request: PublishMerchantConfigurationRequest): Promise<PublishMerchantConfigurationResponse> {
    const { scoped, store, configuration, experiments, clock } = this.#deps;
    const found = await scoped.find(request.actor, request.merchantId);
    if (!found.ok) return found;
    const draft = MerchantConfigurationVersion.draft({
      merchantId: request.merchantId,
      declared: request.declared,
      corrective: request.corrective,
      ...(request.reason === undefined ? {} : { reason: request.reason }),
      publishedAt: clock.now(),
      operatorId: request.actor.operatorId,
    });
    if (!draft.ok) return draft;
    const latest = await store.latestOf(request.merchantId);
    if (latest?.sameContentAs(draft.value) === true) return ok({ version: latest, outcome: "repeated" });
    if (!request.corrective && (await experiments.activeFor(request.merchantId)) !== undefined) {
      return fail(new ConfigurationFrozen());
    }
    const judged = await configuration.judge(draft.value);
    if (!judged.ok) return judged;
    const published = await store.publish(draft.value);
    if (!published.ok) return published;
    await configuration.apply(published.value);
    return ok({ version: published.value, outcome: "created" });
  }
}
