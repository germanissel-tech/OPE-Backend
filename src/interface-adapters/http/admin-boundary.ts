// What the admin controllers share at the boundary (ADR-031): the merchant DTO without any
// credential value, the merchant identifier of the path, the grace of a rotation, and the
// response of a paged collection of a merchant.
import { type CredentialKind, type Merchant } from "../../domain/merchant/index.js";
import { asMerchantId, type MerchantId, type Result } from "../../domain/shared-kernel/index.js";
import { pageDto, pageQueryOf } from "./boundary.js";
import { operatorOf } from "./security/principal.js";
import { HTTP_STATUS } from "./status.js";
import { toProblem, type CataloguedError, type ProblemOf } from "./to-problem.js";
import type { components, operations } from "./generated/api.js";
import type { OperationHandler, TypedRequest } from "./typed.js";
import type { RotateCredentialRequest, RotateCredentialResult } from "../../application/merchant/index.js";
import type { Page, PageQuery, UseCase } from "../../application/shared-kernel/index.js";
import type { AdminEntry, AdminResult } from "../../domain/admin/index.js";
import type { Operator } from "../../domain/operator/index.js";

type MerchantDto = components["schemas"]["Merchant"];
type CredentialSummaryDto = components["schemas"]["CredentialSummary"];

/** Seconds → milliseconds at the edge; the domain works in milliseconds. */
const MS_PER_SECOND = 1000;

/** The merchant as the contract publishes it: credentials by kind and instant, never their values. */
export function merchantDto(merchant: Merchant, now: Date): MerchantDto {
  const live = merchant.credentials.filter(
    (c) => c.expiresAt === undefined || c.expiresAt.getTime() > now.getTime(),
  );
  return {
    merchantId: merchant.merchantId,
    status: merchant.status,
    origins: merchant.origins.map((o) => o.value),
    createdAt: merchant.createdAt.toISOString(),
    credentials: live.map((c): CredentialSummaryDto => ({
      kind: c.kind,
      issuedAt: c.issuedAt.toISOString(),
      ...(c.expiresAt === undefined ? {} : { expiresAt: c.expiresAt.toISOString() }),
    })),
  };
}

/** The merchant identifier of the path (constitution V: the only place it travels). */
export function merchantIdOf(path: { merchantId: string }): MerchantId {
  return asMerchantId(path.merchantId);
}

/** The grace of a rotation in milliseconds; none when the body says nothing. */
function graceMsOf(body: { graceSeconds?: number } | undefined): number {
  return (body?.graceSeconds ?? 0) * MS_PER_SECOND;
}

type AdminEntryDto = components["schemas"]["AdminEntry"];
type AdminResultDto = components["schemas"]["AdminResult"];

/** Only the fields the action produced. */
function resultDto(result: AdminResult): AdminResultDto {
  return {
    ...(result.configurationVersion === undefined
      ? {}
      : { configurationVersion: result.configurationVersion }),
    ...(result.experimentId === undefined ? {} : { experimentId: result.experimentId }),
    ...(result.windowRestarted === undefined ? {} : { windowRestarted: result.windowRestarted }),
  };
}

/** The entry as the contract publishes it: instants as text, optional fields only when present. */
export function adminEntryDto(entry: AdminEntry): AdminEntryDto {
  return {
    at: entry.at.toISOString(),
    operatorId: entry.operatorId,
    operation: entry.operation,
    outcome: entry.outcome,
    ...(entry.merchantId === undefined ? {} : { merchantId: entry.merchantId }),
    ...(entry.code === undefined ? {} : { code: entry.code }),
    ...(entry.result === undefined ? {} : { result: resultDto(entry.result) }),
    ...(entry.reason === undefined ? {} : { reason: entry.reason }),
  };
}

/** A collection of a merchant, paged (ADR-020): the operator, the merchant of the path and the paging of the query. */
export interface MerchantPageRequest {
  actor: Operator;
  merchantId: MerchantId;
  page: PageQuery;
}

type MerchantPageHttpRequest = TypedRequest<operations["listExperiments"]>;

/** The listings of a merchant share one shape: path + paging → use case → 200 with the page. */
export async function merchantPageResponse<T, D, E extends CataloguedError>(
  req: Pick<MerchantPageHttpRequest, "security" | "path" | "query" | "instance">,
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

/** The three rotations share one shape: kind from the operation, grace from the body, the credential once. */
type RotationRequest = TypedRequest<operations["rotateIngestKey"]>;
type RotationResponse = Awaited<ReturnType<OperationHandler<"rotateIngestKey">>>;

export async function rotationResponse(
  req: Pick<RotationRequest, "security" | "path" | "body" | "instance">,
  kind: CredentialKind,
  rotateCredential: UseCase<RotateCredentialRequest, RotateCredentialResult>,
): Promise<RotationResponse> {
  const result = await rotateCredential.execute({
    actor: operatorOf(req),
    merchantId: merchantIdOf(req.path),
    kind,
    graceMs: graceMsOf(req.body),
  });
  if (!result.ok) return toProblem(result.error, req.instance);
  const { value, issuedAt, previousExpiresAt } = result.value;
  return {
    status: HTTP_STATUS.CREATED,
    body: {
      kind: result.value.kind,
      value,
      issuedAt: issuedAt.toISOString(),
      ...(previousExpiresAt === undefined ? {} : { previousExpiresAt: previousExpiresAt.toISOString() }),
    },
  };
}
