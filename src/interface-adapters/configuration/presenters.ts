// What the configuration controllers share at the boundary (constitution XI; ADR-031): the
// levels, the effective configuration and a version as the contract publishes them. The
// domain records are already the shape the configuration speaks (shares, milliseconds,
// closed vocabularies); the contract bounds the condition algebra to two levels of combinators
// where the domain admits any depth, so the record is handed over as the published shape.
import type { PublishedLevel } from "../../application/configuration/index.js";
import type {
  DeclaredConfiguration,
  EffectiveConfiguration,
  MerchantConfigurationVersion,
  PlatformConfiguration,
  TreatmentDefaults,
} from "../../domain/configuration/index.js";
import type { components } from "../http/typed.js";

type PlatformDto = components["schemas"]["PlatformConfiguration"];
type DefaultsDto = components["schemas"]["TreatmentDefaults"];
type EffectiveDto = components["schemas"]["EffectiveConfiguration"];
type DeclaredDto = components["schemas"]["MerchantConfigurationDeclared"];
type VersionDto = components["schemas"]["MerchantConfigurationVersion"];
type LevelVersionDto = components["schemas"]["TreatmentDefaultsVersion"];

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

/**
 * A published version of a level as the contract publishes it (feature 036).
 *
 * The content goes over as it was published: it is already the shape the configuration speaks, and what it
 * is checked against is the reader of its level — the same one the boot uses. What the DTO adds is the
 * **name minted from the number** and which experiments this version restarted, which is the half an
 * operator needs to see what the change cost.
 */
export function levelVersionDto(published: PublishedLevel): LevelVersionDto {
  const { version } = published;
  return {
    version: version.version,
    stampedAs: version.versionName(),
    content: version.content as LevelVersionDto["content"],
    corrective: version.corrective,
    ...(version.reason === undefined ? {} : { reason: version.reason }),
    publishedAt: version.publishedAt.toISOString(),
    operatorId: version.operatorId,
    ...(published.windowsRestarted.length === 0
      ? {}
      : { windowsRestarted: published.windowsRestarted.map((e) => e.experimentId) }),
  };
}
