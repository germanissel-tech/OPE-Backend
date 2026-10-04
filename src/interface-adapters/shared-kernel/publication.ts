// What every published version says about its publication, as the contract publishes it (feature 038):
// whether it was corrective and why, when, by whom, and which measurement windows it restarted. The
// level versions (feature 036) and the text versions carry the same four facts and the same list, and
// two presenters writing them were the duplication the gate refused.
/** The facts of a publication as the contract publishes them; the optional ones absent, never undefined. */
export interface PublicationDto {
  corrective: boolean;
  reason?: string;
  publishedAt: string;
  operatorId: string;
  windowsRestarted?: string[];
}

export function publicationDto(
  version: { corrective: boolean; reason: string | undefined; publishedAt: Date; operatorId: string },
  windowsRestarted: readonly { experimentId: string }[],
): PublicationDto {
  return {
    corrective: version.corrective,
    ...(version.reason === undefined ? {} : { reason: version.reason }),
    publishedAt: version.publishedAt.toISOString(),
    operatorId: version.operatorId,
    ...(windowsRestarted.length === 0
      ? {}
      : { windowsRestarted: windowsRestarted.map((e) => e.experimentId) }),
  };
}
