// What the configuration controllers share at the boundary (constitution XI; ADR-031): the
// levels, the effective configuration and a version as the contract publishes them. The
// domain records are already the shape the configuration speaks (shares, milliseconds,
// closed vocabularies); the contract bounds the condition algebra to two levels of combinators
// where the domain admits any depth, so the record is handed over as the published shape.
import {
  InvalidConfigurationValue,
  type ConfigurationVersionNotFound,
  type DeclaredConfiguration,
  type EffectiveConfiguration,
  type LevelVersion,
  type MerchantConfigurationVersion,
  type PlatformConfiguration,
  type TreatmentDefaults,
} from "../../domain/configuration/index.js";
import { pageDto, pageQueryOf, type PageQueryDto } from "../http/boundary.js";
import { operatorOf } from "../http/security/principal.js";
import { HTTP_STATUS } from "../http/status.js";
import { toProblem, type ProblemOf } from "../http/to-problem.js";
import type {
  GetLevelVersionResponse,
  LevelHistoryReader,
  PublishedLevel,
  PublishLevelRequest,
  PublishLevelResponse,
} from "../../application/configuration/index.js";
import type { Page } from "../../application/shared-kernel/index.js";
import type { ReleaseLevel } from "../../domain/shared-kernel/index.js";
import type { components, SecurityResults } from "../http/typed.js";

type PlatformDto = components["schemas"]["PlatformConfiguration"];
type DefaultsDto = components["schemas"]["TreatmentDefaults"];
type EffectiveDto = components["schemas"]["EffectiveConfiguration"];
type DeclaredDto = components["schemas"]["MerchantConfigurationDeclared"];
type VersionDto = components["schemas"]["MerchantConfigurationVersion"];
/**
 * A published version of a level as the contract publishes it (feature 036).
 *
 * **The envelope is the same for the two levels and only the content differs**, which is why it is a
 * parameter: the number, the name minted from it, who published it, why, and the windows it restarted are
 * the publication itself, and the contract declares one schema per level because its content is a different
 * vocabulary. Written as two unrelated DTOs, the two presenters would be this file twice.
 */
type LevelVersionDto<Content> = Omit<components["schemas"]["TreatmentDefaultsVersion"], "content"> & {
  content: Content;
};

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
 * What the two publications of a level translate, which is the same thing with another name (feature 036).
 *
 * The body of a level is `{ content, corrective?, reason? }` whichever level it is, and the answer is the
 * version created or the one it repeats. Keeping it here is what keeps each controller to the one thing that
 * differs — **which level it publishes** — instead of two files that only differ in a string.
 */
export function publishedLevelRequest(
  level: ReleaseLevel,
  req: {
    security: SecurityResults;
    body: { content: Record<string, unknown>; corrective?: boolean; reason?: string };
  },
): PublishLevelRequest {
  return {
    actor: operatorOf(req),
    level,
    content: { ...req.body.content },
    corrective: req.body.corrective ?? false,
    // Handed over as it comes, absent or not. The guard that turns «undefined» into «not there» lives
    // **once**, where the absence is observed (`publishedBy` of the application).
    reason: req.body.reason,
  };
}

/** Whatever refused a publication: the union the use case answers with, so no code is left untranslated. */
type LevelRefusal = Extract<PublishLevelResponse, { ok: false }>["error"];

/**
 * The `201` of a version created, the `200` of one repeated, or the problem of what refused it.
 *
 * `Content` is the content schema of the level the caller publishes, and it is given explicitly rather than
 * inferred: the two statuses have to stay **separate members** of the answer —the contract declares a body
 * per status, so `{ status: 200 | 201 }` satisfies neither— and that is what makes this typed as a union
 * instead of one object with a union inside.
 */
export function publishedLevelAnswer<Content>(
  result: PublishLevelResponse,
  instance: string,
):
  | { status: typeof HTTP_STATUS.OK; body: LevelVersionDto<Content> }
  | { status: typeof HTTP_STATUS.CREATED; body: LevelVersionDto<Content> }
  | ProblemOf<LevelRefusal> {
  if (!result.ok) {
    // The reader names the field from the root of the content; the body carries it under `content`.
    const error =
      result.error instanceof InvalidConfigurationValue ? result.error.under(CONTENT) : result.error;
    return toProblem(error, instance);
  }
  const body = levelVersionDto<Content>(result.value);
  return result.value.outcome === "created"
    ? { status: HTTP_STATUS.CREATED, body }
    : { status: HTTP_STATUS.OK, body };
}

/** The body field the content lives under: the pointer of an offence starts there. */
const CONTENT = "content";

/**
 * A page of the history of a level, and one version of it (feature 036, US4).
 *
 * The four read operations are the same two answers twice, so what each controller writes is the level it
 * names. A version travels exactly as it was published — it is immutable, so a reader of the history and a
 * reader of what is in force see the same thing.
 */
export function listingOfLevel<Content>(
  level: ReleaseLevel,
  list: LevelHistoryReader,
): (req: { query: PageQueryDto }) => Promise<{
  status: typeof HTTP_STATUS.OK;
  body: { items: LevelVersionDto<Content>[]; nextCursor?: string };
}> {
  return async (req) => ({
    status: HTTP_STATUS.OK,
    body: levelHistoryPage<Content>(await list.execute({ level, page: pageQueryOf(req.query) })),
  });
}

function levelHistoryPage<Content>(page: Page<LevelVersion>): {
  items: LevelVersionDto<Content>[];
  nextCursor?: string;
} {
  return pageDto(page, (version) =>
    levelVersionDto<Content>({ version, outcome: "created", windowsRestarted: [] }),
  );
}

/** One version of the history, or the problem of a number nobody published. */
export function levelVersionAnswer<Content>(
  result: GetLevelVersionResponse,
  instance: string,
):
  | { status: typeof HTTP_STATUS.OK; body: LevelVersionDto<Content> }
  | ProblemOf<ConfigurationVersionNotFound> {
  if (!result.ok) return toProblem(result.error, instance);
  return {
    status: HTTP_STATUS.OK,
    body: levelVersionDto<Content>({ version: result.value, outcome: "created", windowsRestarted: [] }),
  };
}

/**
 * A published version of a level, as the contract publishes it.
 *
 * The content goes over as it was published: it is already the shape the configuration speaks, and what it
 * is checked against is the reader of its level — the same one the boot uses. What the DTO adds is the
 * **name minted from the number** and which experiments this version restarted, which is the half an
 * operator needs to see what the change cost.
 */
function levelVersionDto<Content>(published: PublishedLevel): LevelVersionDto<Content> {
  const { version } = published;
  return {
    version: version.version,
    stampedAs: version.versionName(),
    content: version.content as Content,
    corrective: version.corrective,
    ...(version.reason === undefined ? {} : { reason: version.reason }),
    publishedAt: version.publishedAt.toISOString(),
    operatorId: version.operatorId,
    ...(published.windowsRestarted.length === 0
      ? {}
      : { windowsRestarted: published.windowsRestarted.map((e) => e.experimentId) }),
  };
}
