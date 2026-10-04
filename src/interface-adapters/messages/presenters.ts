// What the controllers of the messages module share: what a publication declares, a text version as the
// contract publishes it, and the answer of a publication (feature 038). Internal to the module.
import { pageDto } from "../http/boundary.js";
import { operatorOf } from "../http/security/principal.js";
import { HTTP_STATUS } from "../http/status.js";
import { toProblem, type CataloguedError, type ProblemOf } from "../http/to-problem.js";
import { publicationDto } from "../shared-kernel/index.js";
import type { PublishedText } from "../../application/messages/index.js";
import type { Page } from "../../application/shared-kernel/index.js";
import type { TextKeyInput, TextVersion } from "../../domain/messages/index.js";
import type { Operator } from "../../domain/operator/index.js";
import type { Result } from "../../domain/shared-kernel/index.js";
import type { SecurityResults, components } from "../http/typed.js";

export type TextVersionDto = components["schemas"]["TextVersion"];

/** What the two inputs of a publication share: the key, and the facts of the publication. */
type TextInputDto = Omit<components["schemas"]["MerchantTextInput"], "remove">;

/**
 * What a publication declares, read from the body as it comes — absent or not, never `undefined` by
 * hand: the guard that turns `undefined` into «not there» lives once, in the domain's judgement of the
 * draft. The two controllers add what is theirs: the base its text, the merchant its identifier.
 */
export function declaredText(req: { security: SecurityResults; body: TextInputDto }): {
  actor: Operator;
  key: TextKeyInput;
  text: string | undefined;
  corrective: boolean;
  reason: string | undefined;
} {
  const { body } = req;
  return {
    actor: operatorOf(req),
    key: { family: body.family, attributeValue: body.attributeValue, locale: body.locale },
    text: body.text,
    corrective: body.corrective ?? false,
    reason: body.reason,
  };
}

/** A published version of a text, as the contract publishes it. */
function textVersionDto(published: PublishedText): TextVersionDto {
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
    layer: version.layer(),
    version: version.version,
    messageVersionId: version.messageVersionId(),
    ...(text === undefined ? {} : { text }),
    removed: version.isRemoved(),
    ...publicationDto(version, published.windowsRestarted),
  };
}

/**
 * The `201` of a version created, the `200` of one repeated, or the problem of what refused it. The two
 * statuses are separate members of the answer because the contract declares a body per status; the refusal
 * is whatever union the use case answers with, so no code is left untranslated.
 */
export function publishedTextAnswer<Refusal extends CataloguedError>(
  result: Result<PublishedText, Refusal>,
  instance: string,
):
  | { status: typeof HTTP_STATUS.OK; body: TextVersionDto }
  | { status: typeof HTTP_STATUS.CREATED; body: TextVersionDto }
  | ProblemOf<Refusal> {
  if (!result.ok) return toProblem(result.error, instance);
  const body = textVersionDto(result.value);
  return result.value.outcome === "created"
    ? { status: HTTP_STATUS.CREATED, body }
    : { status: HTTP_STATUS.OK, body };
}

/** The key of a history read: the family and the language of the path, the value of the query. */
export function textKeyOf(req: {
  path: { family: string; locale: string };
  query?: { attributeValue?: string | undefined } | undefined;
}): TextKeyInput {
  return { family: req.path.family, attributeValue: req.query?.attributeValue, locale: req.path.locale };
}

/**
 * A page of the history of a key, and one version of it (feature 038, US5). A version travels exactly as it
 * was published — it is immutable, so a reader of the history and a reader of what is in force see the same
 * thing — and a version of the history restarted nothing it still has to tell.
 */
export function textHistoryPage(page: Page<TextVersion>): { items: TextVersionDto[]; nextCursor?: string } {
  return pageDto(page, (version) => textVersionDto({ version, outcome: "created", windowsRestarted: [] }));
}

/** One version of the history, or the problem of what refused it. */
export function textVersionAnswer<Refusal extends CataloguedError>(
  result: Result<TextVersion, Refusal>,
  instance: string,
): { status: typeof HTTP_STATUS.OK; body: TextVersionDto } | ProblemOf<Refusal> {
  if (!result.ok) return toProblem(result.error, instance);
  return {
    status: HTTP_STATUS.OK,
    body: textVersionDto({ version: result.value, outcome: "created", windowsRestarted: [] }),
  };
}
