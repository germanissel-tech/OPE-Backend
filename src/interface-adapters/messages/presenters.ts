// What the controllers of the messages module share: a text version as the contract publishes it, and
// the answer of a publication (feature 038). Internal to the module.
import { HTTP_STATUS } from "../http/status.js";
import { toProblem, type ProblemOf } from "../http/to-problem.js";
import type { PublishTextResponse, PublishedText } from "../../application/messages/index.js";
import type { TextVersion } from "../../domain/messages/index.js";
import type { components } from "../http/typed.js";

export type TextVersionDto = components["schemas"]["TextVersion"];

/** What stands for the base layer in the contract. */
const BASE = "base";

/** A published version of a text, as the contract publishes it. */
export function textVersionDto(published: PublishedText): TextVersionDto {
  const { version } = published;
  // The key was judged against the vocabulary when it was published, so the value is one of the
  // contract's; the cast is where that reasoning leaves the compiler.
  const attributeValue = version.key.attributeValue as
    NonNullable<TextVersionDto["attributeValue"]> | undefined;
  const text = version.text?.value;
  return {
    family: version.key.family,
    ...(attributeValue === undefined ? {} : { attributeValue }),
    locale: version.key.locale,
    layer: version.merchantId ?? BASE,
    version: version.version,
    messageVersionId: version.messageVersionId(),
    ...(text === undefined ? {} : { text }),
    removed: version.isRemoved(),
    corrective: version.corrective,
    ...(version.reason === undefined ? {} : { reason: version.reason }),
    publishedAt: version.publishedAt.toISOString(),
    operatorId: version.operatorId,
    ...(published.windowsRestarted.length === 0
      ? {}
      : { windowsRestarted: published.windowsRestarted.map((e) => e.experimentId) }),
  };
}

/** A version read from the history: nothing was restarted by reading it. */
export const historicVersionDto = (version: TextVersion): TextVersionDto =>
  textVersionDto({ version, outcome: "created", windowsRestarted: [] });

/** Whatever refused a publication: the union the use case answers with, so no code is left untranslated. */
type TextRefusal = Extract<PublishTextResponse, { ok: false }>["error"];

/**
 * The `201` of a version created, the `200` of one repeated, or the problem of what refused it. The two
 * statuses are separate members of the answer because the contract declares a body per status.
 */
export function publishedTextAnswer(
  result: PublishTextResponse,
  instance: string,
):
  | { status: typeof HTTP_STATUS.OK; body: TextVersionDto }
  | { status: typeof HTTP_STATUS.CREATED; body: TextVersionDto }
  | ProblemOf<TextRefusal> {
  if (!result.ok) return toProblem(result.error, instance);
  const body = textVersionDto(result.value);
  return result.value.outcome === "created"
    ? { status: HTTP_STATUS.CREATED, body }
    : { status: HTTP_STATUS.OK, body };
}
