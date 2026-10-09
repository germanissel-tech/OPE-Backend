// What the merchant controllers share at the boundary (ADR-031): the merchant as the contract
// publishes it — credentials by kind and instant, never their values — and the response of a
// credential rotation, shared by the three rotations.
import { merchantIdOf } from "../http/boundary.js";
import { operatorOf } from "../http/security/principal.js";
import { HTTP_STATUS } from "../http/status.js";
import { toProblem, type CataloguedError, type ProblemOf } from "../http/to-problem.js";
import type { RotateCredentialRequest, RotateCredentialResult } from "../../application/merchant/index.js";
import type { UseCase } from "../../application/shared-kernel/index.js";
import type {
  CredentialKind,
  Merchant,
  MerchantContactRecord,
  MerchantProfile,
  MerchantProfileRecord,
} from "../../domain/merchant/index.js";
import type { Result } from "../../domain/shared-kernel/index.js";
import type { OperationHandler, TypedRequest, components, operations } from "../http/typed.js";

type MerchantDto = components["schemas"]["Merchant"];
type CredentialSummaryDto = components["schemas"]["CredentialSummary"];
type MerchantContactDto = components["schemas"]["MerchantContact"];
/** The identity as a body carries it: `updateMerchantProfile` whole, and the same part of `MerchantCreate`. */
type MerchantProfileInputDto = components["schemas"]["MerchantProfileInput"];
type MerchantIdentityDto = Pick<MerchantDto, "displayName" | "storeUrl" | "contact" | "notes">;

/** The contact as the contract publishes it: an absent field is absent, not `undefined`. */
function contactDto(contact: MerchantContactRecord): MerchantContactDto {
  return {
    name: contact.name,
    email: contact.email,
    ...(contact.phone === undefined ? {} : { phone: contact.phone }),
    ...(contact.role === undefined ? {} : { role: contact.role }),
  };
}

/** The identity of a merchant as the contract publishes it (ADR-045); nothing for a merchant nobody named. */
export function identityDto(profile: MerchantProfile | undefined): MerchantIdentityDto {
  if (profile === undefined) return {};
  return {
    ...(profile.displayName === undefined ? {} : { displayName: profile.displayName }),
    ...(profile.storeUrl === undefined ? {} : { storeUrl: profile.storeUrl }),
    ...(profile.contact === undefined ? {} : { contact: contactDto(profile.contact) }),
    ...(profile.notes === undefined ? {} : { notes: profile.notes }),
  };
}

/** The identity a body carries, as the domain judges it: the four fields, as written. */
export function profileOf(body: MerchantProfileInputDto): MerchantProfileRecord {
  return {
    displayName: body.displayName,
    storeUrl: body.storeUrl,
    contact: body.contact === undefined ? undefined : { ...body.contact },
    notes: body.notes,
  };
}

/** Seconds → milliseconds at the edge; the domain works in milliseconds. */
const MS_PER_SECOND = 1000;

/**
 * The merchant as the contract publishes it: credentials by kind and instant, never their values.
 *
 * Which credentials are in force is a rule of the aggregate, and it answers it (ADR-024). The
 * instant still comes from the clock of the controller and not with the result of the use case
 * (feature 020, FR-023): the four readings that show a merchant answer with the entity or with a
 * page of entities, and stamping an instant on each of those responses —including a `Page`— to
 * spare the controller a dependency it uses for a rule of the domain buys nothing and touches
 * four response shapes.
 */
export function merchantDto(merchant: Merchant, now: Date): MerchantDto {
  const live = merchant.liveCredentials(now);
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
    ...identityDto(merchant.profile),
  };
}

/** The operations that answer with the merchant as it is now (deactivation, identity): `200` with the entity, or the Problem Details of the error. */
export function merchantResponse<E extends CataloguedError>(
  result: Result<Merchant, E>,
  instance: string,
  now: Date,
): { status: typeof HTTP_STATUS.OK; body: MerchantDto } | ProblemOf<E> {
  if (!result.ok) return toProblem(result.error, instance);
  return { status: HTTP_STATUS.OK, body: merchantDto(result.value, now) };
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
