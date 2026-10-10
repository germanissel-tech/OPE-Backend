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
  StaleVersion,
  type LocaleIncomplete,
  type MerchantId,
  type Result,
  type StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import { publishedBy } from "../services/publication.js";
import { readOfMerchant, type MerchantVersionRead } from "../services/version-restarts.js";
import { merchantConfigurationWitness } from "../services/witness.js";
import type { MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { ExperimentDirectory, WindowRestartsService } from "../../experiment/index.js";
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
  /**
   * The witness of the merchant's configuration as the caller read it (feature 043, ADR-046). The version
   * replaces everything the merchant declares —including what the panel does not edit and copied from the
   * version it read—, so it is accepted only if that version is still the one in force.
   */
  witness: string;
}

/**
 * The version with what it restarted, and whether this request created it. A repetition answers what the
 * version in force restarted when it was published (feature 042), the same as any reading of it.
 */
export interface PublishedConfiguration extends MerchantVersionRead {
  outcome: "created" | "repeated";
}

/** `LocaleIncomplete` is the word of the decorator in front of this use case (feature 038, US4), never of its own deed. */
export type PublishMerchantConfigurationResponse = Result<
  PublishedConfiguration,
  | MerchantOutOfScope
  | MerchantNotFound
  | ConfigurationFrozen
  | VersionError
  | LocaleIncomplete
  | StaleVersion
  | StoreUnavailable
>;

export interface PublishMerchantConfigurationDependencies {
  scoped: ScopedMerchantService;
  store: ConfigurationStore;
  configuration: ConfigurationService;
  experiments: ExperimentDirectory;
  /** The restart of the window, and what a version restarted (feature 042): the experiment module's. */
  restarts: WindowRestartsService;
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
    const { scoped, store, configuration, experiments, restarts, clock } = this.#deps;
    const found = await scoped.find(request.actor, request.merchantId);
    if (!found.ok) return found;
    const draft = MerchantConfigurationVersion.draft({
      merchantId: request.merchantId,
      declared: request.declared,
      ...publishedBy(request, clock),
    });
    if (!draft.ok) return draft;
    const latest = await store.latestOf(request.merchantId);
    if (latest?.sameContentAs(draft.value) === true) {
      return ok({ ...(await readOfMerchant(restarts, latest)), outcome: "repeated" });
    }
    // After the scope and the repetition, before the freeze (ADR-046): a merchant outside the scope is not
    // revealed by its witness, the retry of what went through answers as before, and the 409 of something
    // that changed explains nothing. The unit of work of the audit takes its turn, so nothing is published
    // between this comparison and the write (feature 034).
    if (merchantConfigurationWitness(request.merchantId, latest?.version) !== request.witness) {
      return fail(new StaleVersion());
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
    const reached = active === undefined ? [] : [active];
    // The corrective version restarts the window of the active experiment (D-G), recording the level and the
    // number that caused it (feature 036): the same restart the levels and the texts do.
    const restarted = await restarts.restart(reached, {
      at: published.value.publishedAt,
      reason: published.value.reason,
      level: "merchant",
      version: published.value.version,
    });
    if (!restarted.ok) return restarted;
    return ok({ version: published.value, outcome: "created", windowsRestarted: reached });
  }
}
