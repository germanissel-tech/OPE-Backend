// What a merchant declared about the texts it is served (feature 027, constitution X): the languages
// and the correspondence of its attribute labels, resolved by the configuration service over the
// treatment defaults, the same way the policy directory resolves the three policies. The voice left in
// feature 038: a merchant's preference is its own layer of texts, not a style it picks.
import type { ConfigurationService } from "../../../application/configuration/index.js";
import type { MessageDirectory, MessageSettings } from "../../../application/messages/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export const messageSettingsOf = (configuration: ConfigurationService): MessageDirectory => ({
  settingsFor: async (merchantId: MerchantId): Promise<MessageSettings> => {
    const effective = await configuration.effectiveFor(merchantId);
    const { locales } = effective.values;
    return {
      labels: effective.labels,
      ...(locales.fallback === undefined ? {} : { fallback: locales.fallback }),
    };
  },
});
