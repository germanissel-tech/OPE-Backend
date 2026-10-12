// Application service: the effective configuration of every merchant (FR-010, FR-017;
// constitution XI; ADR-031), resolved when a version is published (or first asked for) and
// served from memory to whoever consumes it — the decision plane, the catalogue, the SDK —
// through the ports those modules declare. The levels of the release are read once; a version
// applied here counts on the next request, without a restart.
import {
  EffectiveConfiguration,
  InvalidConfigurationValue,
  type ConfigurationDraft,
  type LevelDraft,
  type MerchantConfigurationVersion,
  type PlatformConfiguration,
  type TreatmentDefaults,
  type TreatmentValues,
} from "../../../domain/configuration/index.js";
import { fail, ok, SYNC_FLOWS, type MerchantId, type Result } from "../../../domain/shared-kernel/index.js";
import { readTreatmentDefaults } from "../input/declared.js";
import { readPlatformConfiguration } from "../input/platform.js";
import type { ConfigurationLevels } from "../ports/configuration-levels.js";
import type { ConfigurationStore } from "../ports/configuration-store.js";
import type { PlatformSources } from "../ports/platform-sources.js";

export interface ConfigurationService {
  /** What the merchant is served with now: its version in force over the levels of the release. */
  effectiveFor(merchantId: MerchantId): Promise<EffectiveConfiguration>;
  /** Whether a draft resolves over the levels in force, and to what. */
  judge(draft: ConfigurationDraft): Promise<Result<EffectiveConfiguration, InvalidConfigurationValue>>;
  /**
   * Whether the content of a level version is one this build can read, before it becomes a version
   * (feature 036).
   *
   * It is the counterpart of `judge` one level up: what a merchant declares is judged **resolved** over the
   * defaults, and the content of a level is judged against the vocabulary of **its own** level, because
   * there is nothing above it to resolve against.
   */
  judgeLevel(draft: LevelDraft): Promise<Result<undefined, InvalidConfigurationValue>>;
  /**
   * Forgets every effective configuration and reads the levels again (feature 036).
   *
   * **It forgets the merchants and does not recompute them**, which is the whole cost of a level change: the
   * resolution of each merchant is lazy, so the next request of each one resolves again — exactly what
   * already happens after a boot. Recomputing for every merchant would be work for a cache nobody asked for.
   *
   * **The levels are the exception, and they are read here rather than forgotten**: `platformInForce()`
   * answers synchronously from what this holds, so leaving it empty would make every consumer of a level 1
   * value fail between a publication and the next read of it. Reading them costs one query per level, off
   * every critical path, and leaves no window where the value is missing.
   */
  refresh(): Promise<void>;
  /**
   * The platform level in force, from memory and with no I/O: what `PlatformLevelReader` hands to the
   * eleven components that used to receive its values at construction.
   *
   * It throws if the boot has not loaded a level yet, which is a programming error and not a state the
   * server can be in: the seed is imported and the levels are read before anything listens.
   */
  platformInForce(): PlatformConfiguration;
  /** A version the store accepted becomes the one served, at once. */
  apply(version: MerchantConfigurationVersion): Promise<EffectiveConfiguration>;
  platform(): Promise<PlatformConfiguration>;
  defaults(): Promise<TreatmentDefaults>;
}

export interface ConfigurationServiceDependencies {
  levels: ConfigurationLevels;
  store: ConfigurationStore;
  sources: PlatformSources;
}

interface Levels {
  platform: PlatformConfiguration;
  defaults: TreatmentDefaults;
}

export class Configurations implements ConfigurationService {
  readonly #deps: ConfigurationServiceDependencies;
  readonly #effective = new Map<MerchantId, EffectiveConfiguration>();
  #levels: Promise<Levels> | undefined;
  /** The last levels this resolved, for the readers that cannot await (feature 036). */
  #inForce: Levels | undefined;

  constructor(deps: ConfigurationServiceDependencies) {
    this.#deps = deps;
  }

  async effectiveFor(merchantId: MerchantId): Promise<EffectiveConfiguration> {
    const served = this.#effective.get(merchantId);
    if (served !== undefined) return served;
    return this.#resolve(merchantId, await this.#deps.store.latestOf(merchantId));
  }

  async judge(draft: ConfigurationDraft): Promise<Result<EffectiveConfiguration, InvalidConfigurationValue>> {
    const { platform, defaults } = await this.#loadLevels();
    const resolved = EffectiveConfiguration.resolve(platform, defaults, draft);
    if (!resolved.ok) return resolved;
    const unread = this.#unread(resolved.value.values);
    return unread === undefined ? resolved : fail(unread);
  }

  apply(version: MerchantConfigurationVersion): Promise<EffectiveConfiguration> {
    return this.#resolve(version.merchantId, version);
  }

  /**
   * The content of a level, read by the reader of **that** level: the one that knows its vocabulary and
   * names the field it refuses.
   *
   * The `version` the readers require is not in what an operator publishes —it is minted from the number—
   * so a placeholder stands in for the shape of the check. It is never stored: what is stored is the content
   * as it was published, and the name is minted when it is read back.
   */
  judgeLevel(draft: LevelDraft): Promise<Result<undefined, InvalidConfigurationValue>> {
    const named = { ...draft.content, version: `${draft.level}-draft` };
    if (draft.level === "platform") {
      const read = readPlatformConfiguration(named);
      return Promise.resolve(read.ok ? ok(undefined) : fail(read.error));
    }
    const read = readTreatmentDefaults(named);
    if (!read.ok) return Promise.resolve(fail(read.error));
    const unread = this.#unread(read.value.values);
    return Promise.resolve(unread === undefined ? ok(undefined) : fail(unread));
  }

  async refresh(): Promise<void> {
    this.#levels = undefined;
    this.#effective.clear();
    await this.#loadLevels();
  }

  platformInForce(): PlatformConfiguration {
    if (this.#inForce === undefined) {
      throw new Error("The levels in force were asked for before the boot read them.");
    }
    return this.#inForce.platform;
  }

  async platform(): Promise<PlatformConfiguration> {
    return (await this.#loadLevels()).platform;
  }

  async defaults(): Promise<TreatmentDefaults> {
    return (await this.#loadLevels()).defaults;
  }

  /**
   * A mode nothing in this deployment would execute (research R-08): the merchant's source is not installed, or
   * it does not read a flow by the mode the values give it. `push` needs no source: the platform sends.
   *
   * Asked when a version is **published** and never when one is resolved: what the store holds was judged
   * when it entered, and a deployment that later leaves a source out must still serve the merchant — what
   * stops is the reading, which the scheduler reports per flow.
   */
  #unread(values: TreatmentValues): InvalidConfigurationValue | undefined {
    const modes = this.#deps.sources.modesOf(values.platformSource);
    if (modes === undefined) {
      return new InvalidConfigurationValue("platformSource", "must be a source this deployment installed");
    }
    const flow = SYNC_FLOWS.find(
      (each) => values.syncStrategy[each] !== "push" && !modes[each].includes(values.syncStrategy[each]),
    );
    if (flow === undefined) return undefined;
    const problem = `must be a mode the source ${values.platformSource} reads this flow by`;
    return new InvalidConfigurationValue(`syncStrategy.${flow}`, problem);
  }

  /** A recorded version resolves by construction: what the store holds was judged when published. */
  async #resolve(
    merchantId: MerchantId,
    version: MerchantConfigurationVersion | undefined,
  ): Promise<EffectiveConfiguration> {
    const { platform, defaults } = await this.#loadLevels();
    const resolved = EffectiveConfiguration.resolve(platform, defaults, version);
    if (!resolved.ok)
      throw new Error(`A recorded configuration version no longer resolves: ${resolved.error.message}`);
    this.#effective.set(merchantId, resolved.value);
    return resolved.value;
  }

  #loadLevels(): Promise<Levels> {
    this.#levels ??= Promise.all([this.#deps.levels.platform(), this.#deps.levels.defaults()]).then(
      ([platform, defaults]) => {
        // Kept for the synchronous reader, and assigned **here** rather than next to the await of whoever
        // asked: this is the one place the levels are resolved, so there is no path that loads them and
        // leaves the reader behind.
        this.#inForce = { platform, defaults };
        return this.#inForce;
      },
    );
    return this.#levels;
  }
}
