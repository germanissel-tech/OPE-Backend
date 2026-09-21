// The levels of the release as the configuration read them at start-up (constitution XI;
// ADR-031): served from memory, never written. Which files they come from is the
// configuration's business (`OPE_PLATFORM_CONFIG`, `OPE_TREATMENT_DEFAULTS`).
import type { ConfigurationLevels } from "../../../application/configuration/index.js";
import type { PlatformConfiguration, TreatmentDefaults } from "../../../domain/configuration/index.js";

export function releaseConfigurationLevels(levels: {
  platform: PlatformConfiguration;
  defaults: TreatmentDefaults;
}): ConfigurationLevels {
  return {
    platform: () => Promise.resolve(levels.platform),
    defaults: () => Promise.resolve(levels.defaults),
  };
}
