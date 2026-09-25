// What a merchant declared about the texts it is served (feature 027, constitution X): the voice
// and the languages, resolved by the configuration service over the treatment defaults, the same
// way the policy directory resolves the three policies. A merchant that declared no voice is
// served the default one — OPE writes every voice, so there is always one to fall back to.
import { DEFAULT_VOICE, type MerchantId } from "../../../domain/shared-kernel/index.js";
import type { ConfigurationService } from "../../../application/configuration/index.js";
import type { MessageDirectory, MessageSettings } from "../../../application/messages/index.js";

export const messageSettingsOf = (configuration: ConfigurationService): MessageDirectory => ({
  settingsFor: async (merchantId: MerchantId): Promise<MessageSettings> => {
    const effective = await configuration.effectiveFor(merchantId);
    const { locales } = effective.values;
    return {
      labels: effective.labels,
      // One voice, so there is nothing for a merchant to choose yet: the corpus is keyed by voice
      // from day one so the second is one more entry, and the field that picks it arrives with it.
      voice: DEFAULT_VOICE,
      ...(locales.fallback === undefined ? {} : { fallback: locales.fallback }),
    };
  },
});
