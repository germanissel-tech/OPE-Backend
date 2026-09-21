// The configuration a merchant is served with (FR-010; constitution XI; ADR-031): what it
// declared, else the treatment defaults, value by value, with the platform values on top and
// the three versions every decision stamps (01 §14.2). Computed when a version is published
// or the seed imported, kept in memory, never stored.
import { fail, ok, type ConfigurationVersions, type Result } from "../shared-kernel/index.js";
import { AnchorMap } from "./anchor-map.js";
import { TreatmentValues } from "./treatment-values.js";
import type { InvalidConfigurationValue } from "./errors.js";
import type { ConfigurationDraft, MerchantConfigurationVersion } from "./merchant-configuration-version.js";
import type { PlatformConfiguration } from "./platform-configuration.js";
import type { TreatmentDefaults } from "./treatment-defaults.js";

export class EffectiveConfiguration {
  readonly values: TreatmentValues;
  readonly anchors: AnchorMap | undefined;
  readonly platform: PlatformConfiguration;
  readonly versions: ConfigurationVersions;

  private constructor(
    values: TreatmentValues,
    anchors: AnchorMap | undefined,
    platform: PlatformConfiguration,
    versions: ConfigurationVersions,
  ) {
    this.values = values;
    this.anchors = anchors;
    this.platform = platform;
    this.versions = versions;
  }

  /**
   * The resolution: the merchant's version (a published one, or a draft being judged) over the
   * defaults; without one, the defaults as they are. A value the merge makes invalid names its
   * field from the root of the declared values; the adapter says where they came from.
   */
  static resolve(
    platform: PlatformConfiguration,
    defaults: TreatmentDefaults,
    version?: MerchantConfigurationVersion | ConfigurationDraft,
  ): Result<EffectiveConfiguration, InvalidConfigurationValue> {
    const versions: ConfigurationVersions = { platform: platform.version, defaults: defaults.version };
    if (version === undefined)
      return ok(new EffectiveConfiguration(defaults.values, undefined, platform, versions));
    const values = TreatmentValues.resolve(defaults.values.record(), version.declared);
    if (!values.ok) return fail(values.error);
    const anchors =
      version.declared.anchors === undefined ? undefined : AnchorMap.rehydrate(version.declared.anchors);
    const merchant = "version" in version ? { merchant: version.version } : {};
    return ok(new EffectiveConfiguration(values.value, anchors, platform, { ...versions, ...merchant }));
  }
}
