// What every controller may share at the boundary, whatever its module: DTO → Date (ADR-024: an
// unparsable date-time the contract admitted is a programming error), the idempotent answer of
// a notification (first receipt 201, repeat 200), the paging of a collection read, the merchant
// identifier of an admin path (constitution V) and the response of a paged collection of a
// merchant. Nothing here knows a feature module: the presenters of each module live with it.
import { asMerchantId, type MerchantId, type Result } from "../../domain/shared-kernel/index.js";
import { operatorOf } from "./security/principal.js";
import { HTTP_STATUS } from "./status.js";
import { toProblem, type CataloguedError, type ProblemOf } from "./to-problem.js";
import type { SecurityResults } from "./typed.js";
import type { Page, PageQuery, UseCase } from "../../application/shared-kernel/index.js";
import type { Operator } from "../../domain/operator/index.js";

export function instantOf(text: string): Date {
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error(`The contract admitted an unparsable date-time: ${text}`);
  return date;
}

const CREATED = HTTP_STATUS.CREATED;
const REPEATED = HTTP_STATUS.OK;

/** The two 2xx of an idempotent notification (ADR-020): created → 201, repeated → 200. */
export function idempotent<B>(
  outcome: "created" | "repeated",
  body: B,
): { status: typeof CREATED; body: B } | { status: typeof REPEATED; body: B } {
  return outcome === "created" ? { status: CREATED, body } : { status: REPEATED, body };
}

/** The page size when the caller says nothing: the contract's default of `limit`. */
const DEFAULT_PAGE_LIMIT = 50;

/** The query of a collection read as the contract validates and coerces it. */
export type PageQueryDto = { cursor?: string | undefined; limit?: number | undefined } | undefined;

/** The paging of a collection read (ADR-020) from the query the contract validated and coerced. */
export function pageQueryOf(query: PageQueryDto): PageQuery {
  return {
    ...(query?.cursor === undefined ? {} : { cursor: query.cursor }),
    limit: query?.limit ?? DEFAULT_PAGE_LIMIT,
  };
}

/** A page as the contract publishes it: `nextCursor` only when there is a next page. */
export function pageDto<T, D>(page: Page<T>, item: (value: T) => D): { items: D[]; nextCursor?: string } {
  return {
    items: page.items.map(item),
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
  };
}

/** The merchant identifier of the path (constitution V: the only place it travels). */
export function merchantIdOf(path: { merchantId: string }): MerchantId {
  return asMerchantId(path.merchantId);
}

/** A collection of a merchant, paged (ADR-020): the operator, the merchant of the path and the paging of the query. */
export interface MerchantPageRequest {
  actor: Operator;
  merchantId: MerchantId;
  page: PageQuery;
}

/** What a listing of a merchant reads from its request: the operator, the path and the paging. */
export interface MerchantPageHttpRequest {
  security: SecurityResults;
  path: { merchantId: string };
  query: PageQueryDto;
  instance: string;
}

/** The listings of a merchant share one shape: path + paging → use case → 200 with the page. */
export async function merchantPageResponse<T, D, E extends CataloguedError>(
  req: MerchantPageHttpRequest,
  list: UseCase<MerchantPageRequest, Result<Page<T>, E>>,
  item: (value: T) => D,
): Promise<{ status: typeof HTTP_STATUS.OK; body: { items: D[]; nextCursor?: string } } | ProblemOf<E>> {
  const result = await list.execute({
    actor: operatorOf(req),
    merchantId: merchantIdOf(req.path),
    page: pageQueryOf(req.query),
  });
  if (!result.ok) return toProblem(result.error, req.instance);
  return { status: HTTP_STATUS.OK, body: pageDto(result.value, item) };
}
