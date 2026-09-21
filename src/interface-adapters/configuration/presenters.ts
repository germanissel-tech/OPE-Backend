// What the configuration controllers share at the boundary (constitution XI; ADR-031): the
// levels, the effective configuration and a version as the contract publishes them. The
// domain records are already the shape the configuration speaks (percentages, milliseconds,
// closed vocabularies); the contract bounds the condition algebra to two levels of combinators
// where the domain admits any depth, so the record is handed over as the published shape.
import type {
  DeclaredConfiguration,
  EffectiveConfiguration,
  MerchantConfigurationVersion,
  PlatformConfiguration,
  TreatmentDefaults,
} from "../../domain/configuration/index.js";
import type { components } from "../http/generated/api.js";

type PlatformDto = components["schemas"]["PlatformConfiguration"];
type DefaultsDto = components["schemas"]["TreatmentDefaults"];
type EffectiveDto = components["schemas"]["EffectiveConfiguration"];
type DeclaredDto = components["schemas"]["MerchantConfigurationDeclared"];
type VersionDto = components["schemas"]["MerchantConfigurationVersion"];

export function platformDto(platform: PlatformConfiguration): PlatformDto {
  return platform.record();
}

export function treatmentDefaultsDto(defaults: TreatmentDefaults): DefaultsDto {
  return defaults.record() as DefaultsDto;
}

export function declaredDto(declared: DeclaredConfiguration): DeclaredDto {
  return declared as DeclaredDto;
}

export function effectiveDto(effective: EffectiveConfiguration): EffectiveDto {
  const anchors = effective.anchors?.record() as EffectiveDto["anchors"];
  return {
    ...(effective.values.record() as Omit<EffectiveDto, "platform" | "anchors">),
    ...(anchors === undefined ? {} : { anchors }),
    platform: platformDto(effective.platform),
  };
}

export function versionDto(version: MerchantConfigurationVersion): VersionDto {
  return {
    version: version.version,
    declared: declaredDto(version.declared),
    corrective: version.corrective,
    ...(version.reason === undefined ? {} : { reason: version.reason }),
    publishedAt: version.publishedAt.toISOString(),
    operatorId: version.operatorId,
  };
}
