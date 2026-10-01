// Application service: the effective configuration of every merchant (FR-010, FR-017;
// constitution XI; ADR-031), resolved when a version is published (or first asked for) and
// served from memory to whoever consumes it — the decision plane, the catalogue, the SDK —
// through the ports those modules declare. The levels of the release are read once; a version
// applied here counts on the next request, without a restart.
import {
  EffectiveConfiguration,
  type ConfigurationDraft,
  type LevelDraft,
  type InvalidConfigurationValue,
  type MerchantConfigurationVersion,
  type PlatformConfiguration,
  type TreatmentDefaults,
} from "../../../domain/configuration/index.js";
import { fail, ok, type MerchantId, type Result } from "../../../domain/shared-kernel/index.js";
import { readTreatmentDefaults } from "../input/declared.js";
import { readPlatformConfiguration } from "../input/platform.js";
import type { ConfigurationLevels } from "../ports/configuration-levels.js";
import type { ConfigurationStore } from "../ports/configuration-store.js";

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
   * Forgets the levels in force and every effective configuration resolved from them (feature 036).
   *
   * **It invalidates and does not recompute**, which is the whole cost of a level change: the resolution of
   * each merchant is lazy, so the next request of each one resolves again — exactly what already happens
   * after a boot. Recomputing for every merchant would be work for a cache nobody has asked for yet.
   */
  invalidate(): void;
  /** A version the store accepted becomes the one served, at once. */
  apply(version: MerchantConfigurationVersion): Promise<EffectiveConfiguration>;
  platform(): Promise<PlatformConfiguration>;
  defaults(): Promise<TreatmentDefaults>;
}

export interface ConfigurationServiceDependencies {
  levels: ConfigurationLevels;
  store: ConfigurationStore;
}

interface Levels {
  platform: PlatformConfiguration;
  defaults: TreatmentDefaults;
}

export class Configurations implements ConfigurationService {
  readonly #deps: ConfigurationServiceDependencies;
  readonly #effective = new Map<MerchantId, EffectiveConfiguration>();
  #levels: Promise<Levels> | undefined;

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
    return EffectiveConfiguration.resolve(platform, defaults, draft);
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
    const read = draft.level === "platform" ? readPlatformConfiguration(named) : readTreatmentDefaults(named);
    return Promise.resolve(read.ok ? ok(undefined) : fail(read.error));
  }

  invalidate(): void {
    this.#levels = undefined;
    this.#effective.clear();
  }

  async platform(): Promise<PlatformConfiguration> {
    return (await this.#loadLevels()).platform;
  }

  async defaults(): Promise<TreatmentDefaults> {
    return (await this.#loadLevels()).defaults;
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
      ([platform, defaults]) => ({ platform, defaults }),
    );
    return this.#levels;
  }
}
