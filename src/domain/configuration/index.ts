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
export { ChangedLeaves } from "./changed-leaves.js";
export { LevelVersion } from "./level-version.js";
export type { LevelDraft, LevelVersionRecord } from "./level-version.js";
export { PolicyInput } from "./policy-inputs.js";
export type {
  CommercialPolicyDeclared,
  CommercialPolicyInput,
  DecisionPolicyDeclared,
  DecisionPolicyInput,
  EvidenceProfileDeclared,
  EvidenceProfileInput,
} from "./policy-inputs.js";
export { SURFACES } from "./vocabulary.js";
// How a flow reaches OPE and what OPE reads it with are the kernel's and the platform's vocabularies (feature
// 044); the configuration declares them per merchant.
export { PLATFORM_SOURCES } from "../platform/index.js";
export type { PlatformSourceName } from "../platform/index.js";
export { SYNC_FLOWS, SYNC_MODES } from "../shared-kernel/index.js";
export type { SyncFlow, SyncMode, SyncStrategy } from "../shared-kernel/index.js";
// Re-exported from the kernel since feature 038, so nothing that read them here moves.
export { ConfigurationFrozen, ConfigurationReasonRequired, LOCALE_PATTERN } from "../shared-kernel/index.js";
export type { Locales, Surface } from "./vocabulary.js";
export { ConfigurationVersionNotFound, InvalidConfigurationValue } from "./errors.js";
export type { ConfigurationError } from "./errors.js";
