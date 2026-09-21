// The levels of the release (constitution XI; ADR-031): the platform configuration and the
// treatment defaults, read once at start-up from the files that travel with the code and
// served from memory. Nothing writes them: they change with a deploy.
import type { PlatformConfiguration, TreatmentDefaults } from "../../../domain/configuration/index.js";

export interface ConfigurationLevels {
  platform(): Promise<PlatformConfiguration>;
  defaults(): Promise<TreatmentDefaults>;
}
