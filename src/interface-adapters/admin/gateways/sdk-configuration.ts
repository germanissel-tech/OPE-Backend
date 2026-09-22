// What the SDK may see of the configuration of its merchant (01 §3.1.1): versions, surfaces,
// languages and the anchor map; never a policy, a margin, a rung, a split, an arm or an
// experiment. The administration owns this port and implements it over the resolution, because it
// may see the configuration and the configuration may not see it.
import type { SdkConfigurationSource } from "../../../application/admin/index.js";
import type { ConfigurationService } from "../../../application/configuration/index.js";

export function sdkConfigurationOf(configuration: ConfigurationService): SdkConfigurationSource {
  return {
    async sdkConfigurationFor(merchantId) {
      const effective = await configuration.effectiveFor(merchantId);
      const { surfaces, locales } = effective.values;
      const anchors = effective.anchors?.record();
      return {
        versions: effective.versions,
        surfaces,
        locales,
        ...(anchors === undefined ? {} : { anchors }),
      };
    },
  };
}
