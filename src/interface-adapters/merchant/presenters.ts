// What the merchant controllers share at the boundary (ADR-031): the merchant as the contract
// publishes it — credentials by kind and instant, never their values — and the response of a
// credential rotation, shared by the three rotations.
import { merchantIdOf } from "../http/boundary.js";
import { operatorOf } from "../http/security/principal.js";
import { HTTP_STATUS } from "../http/status.js";
import { toProblem } from "../http/to-problem.js";
import type { RotateCredentialRequest, RotateCredentialResult } from "../../application/merchant/index.js";
import type { UseCase } from "../../application/shared-kernel/index.js";
import type { CredentialKind, Merchant } from "../../domain/merchant/index.js";
import type { OperationHandler, TypedRequest, components, operations } from "../http/typed.js";

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

/** The grace of a rotation in milliseconds; none when the body says nothing. */
function graceMsOf(body: { graceSeconds?: number } | undefined): number {
  return (body?.graceSeconds ?? 0) * MS_PER_SECOND;
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
