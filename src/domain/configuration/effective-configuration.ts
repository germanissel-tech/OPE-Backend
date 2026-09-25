// The configuration a merchant is served with (FR-010; constitution XI; ADR-031): what it
// declared, else the treatment defaults, value by value, with the platform values on top and
// the three versions every decision stamps (01 §14.2). Computed when a version is published
// or the seed imported, kept in memory, never stored.
import { AttributeLabels } from "../messages/index.js";
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
  /** What the merchant's attribute labels mean to OPE; empty when it declared none. */
  readonly labels: AttributeLabels;
  readonly platform: PlatformConfiguration;
  readonly versions: ConfigurationVersions;

  /** One object and not five positions: the order of five arguments is a bug waiting to be written. */
  private constructor(parts: {
    values: TreatmentValues;
    anchors: AnchorMap | undefined;
    labels: AttributeLabels;
    platform: PlatformConfiguration;
    versions: ConfigurationVersions;
  }) {
    this.values = parts.values;
    this.anchors = parts.anchors;
    this.labels = parts.labels;
    this.platform = parts.platform;
    this.versions = parts.versions;
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
      return ok(
        new EffectiveConfiguration({
          values: defaults.values,
          anchors: undefined,
          labels: AttributeLabels.empty(),
          platform,
          versions,
        }),
      );
    const values = TreatmentValues.resolve(defaults.values.record(), version.declared);
    if (!values.ok) return fail(values.error);
    const anchors =
      version.declared.anchors === undefined ? undefined : AnchorMap.rehydrate(version.declared.anchors);
    // Judged when the version was published, so it is rehydrated and not re-judged (ADR-024).
    const labels =
      version.declared.attributeLabels === undefined
        ? AttributeLabels.empty()
        : AttributeLabels.rehydrate(version.declared.attributeLabels);
    const merchant = "version" in version ? { merchant: version.version } : {};
    return ok(
      new EffectiveConfiguration({
        values: values.value,
        anchors,
        labels,
        platform,
        versions: { ...versions, ...merchant },
      }),
    );
  }
}
