// Public API of the configuration module (domain; constitution XI; ADR-031): the three levels,
// their resolution, and the vocabularies of the configuration.
export { PlatformConfiguration } from "./platform-configuration.js";
export type { DedupWindowRecord, PlatformConfigurationRecord } from "./platform-configuration.js";
export { TreatmentDefaults } from "./treatment-defaults.js";
export type { TreatmentDefaultsRecord } from "./treatment-defaults.js";
export { TreatmentValues } from "./treatment-values.js";
export type { DeclaredTreatmentValues, TreatmentValuesRecord } from "./treatment-values.js";
export { MerchantConfigurationVersion } from "./merchant-configuration-version.js";
export type {
  ConfigurationDraft,
  DeclaredConfiguration,
  MerchantConfigurationVersionRecord,
  VersionError,
} from "./merchant-configuration-version.js";
export { EffectiveConfiguration } from "./effective-configuration.js";
export { AnchorMap } from "./anchor-map.js";
export type { AnchorMapRecord, AnchorSelectors } from "./anchor-map.js";
export { PolicyInput } from "./policy-inputs.js";
export type {
  CommercialPolicyDeclared,
  CommercialPolicyInput,
  DecisionPolicyDeclared,
  DecisionPolicyInput,
  EvidenceProfileDeclared,
  EvidenceProfileInput,
} from "./policy-inputs.js";
export { LOCALE_PATTERN, SURFACES, SYNC_FLOWS, SYNC_MODES } from "./vocabulary.js";
export type { Locales, Surface, SyncFlow, SyncMode, SyncStrategy } from "./vocabulary.js";
export { ConfigurationFrozen, ConfigurationReasonRequired, InvalidConfigurationValue } from "./errors.js";
export type { ConfigurationError } from "./errors.js";
