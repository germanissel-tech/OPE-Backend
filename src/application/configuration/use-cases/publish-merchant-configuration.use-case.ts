// publishMerchantConfiguration (01 §14.2; 03 §4.10; constitution XI; ADR-031): the next
// version of a merchant's configuration. Within the operator's scope; identical to the version
// in force it repeats it (ADR-020); while an experiment is active only a corrective version,
// with its reason, is accepted, and it restarts the accumulation window of the experiment
// (03 §4.10, D-G); the draft is judged by its own rules and by the resolution over the levels
// in force; the store numbers it; it is served from that instant.
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
import type { Experiment } from "../../../domain/experiment/index.js";
import type { MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { ExperimentDirectory, ExperimentStore } from "../../experiment/index.js";
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
  /** Whether the version restarted the accumulation window of the active experiment. */
  windowRestarted: boolean;
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
  experimentStore: ExperimentStore;
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
    const { scoped, store, configuration, experiments, experimentStore, clock } = this.#deps;
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
    if (latest?.sameContentAs(draft.value) === true) {
      return ok({ version: latest, outcome: "repeated", windowRestarted: false });
    }
    // Only an active experiment freezes; a calibrating one still moves (03 §4.10).
    const open = await experiments.activeFor(request.merchantId);
    const active = open?.isActive() === true ? open : undefined;
    if (active !== undefined && !request.corrective) return fail(new ConfigurationFrozen());
    const judged = await configuration.judge(draft.value);
    if (!judged.ok) return judged;
    const published = await store.publish(draft.value);
    if (!published.ok) return published;
    await configuration.apply(published.value);
    if (active === undefined)
      return ok({ version: published.value, outcome: "created", windowRestarted: false });
    const restarted = await this.#restartWindow(active, published.value, experimentStore);
    if (!restarted.ok) return restarted;
    return ok({ version: published.value, outcome: "created", windowRestarted: true });
  }

  /** The corrective version restarts the window of the active experiment (D-G): the entity decides, the store records. */
  async #restartWindow(
    active: Experiment,
    version: MerchantConfigurationVersion,
    experimentStore: ExperimentStore,
  ): Promise<Result<Experiment, StoreUnavailable>> {
    // The draft guarantees the reason of a corrective version and only an active experiment
    // freezes: a store that answers otherwise is a programming error, not a business outcome.
    if (version.reason === undefined) throw new Error("A corrective version carries a reason.");
    const restarted = active.windowRestarted(version.publishedAt, version.reason, version.version);
    if (!restarted.ok) throw new Error("The window of an experiment that is not active cannot restart.");
    return experimentStore.update(restarted.value);
  }
}
