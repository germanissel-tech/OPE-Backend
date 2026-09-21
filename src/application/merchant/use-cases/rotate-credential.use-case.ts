// rotateIngestKey / rotatePlatformKey / rotatePlatformSecret (ADR-014, ADR-029, ADR-031): a new
// credential of the kind, answered once; the previous one lives on for the declared grace,
// bounded by the platform. The rule is the merchant's (`rotated`); the store keeps the outcome.
import {
  Merchant,
  type CredentialKind,
  type MerchantDeactivated,
  type MerchantNotFound,
  type RotationGraceTooLong,
} from "../../../domain/merchant/index.js";
import {
  fail,
  ok,
  type MerchantId,
  type Result,
  type StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { CredentialMinter } from "../ports/credential-minter.js";
import type { MerchantStore } from "../ports/merchant-store.js";
import type { RotationPolicy } from "../ports/rotation-policy.js";
import type { ScopedMerchantService } from "../services/scoped-merchant.service.js";

export interface RotateCredentialRequest {
  actor: Operator;
  merchantId: MerchantId;
  kind: CredentialKind;
  graceMs: number;
}

export interface RotateCredentialResponse {
  merchant: Merchant;
  kind: CredentialKind;
  /** The new value: the only time it travels. */
  value: string;
  issuedAt: Date;
  /** When the previous credential stops being valid, if there was one. */
  previousExpiresAt?: Date | undefined;
}

export type RotateCredentialResult = Result<
  RotateCredentialResponse,
  MerchantOutOfScope | MerchantNotFound | RotationGraceTooLong | MerchantDeactivated | StoreUnavailable
>;

export interface RotateCredentialDependencies {
  scoped: ScopedMerchantService;
  merchants: MerchantStore;
  minter: CredentialMinter;
  rotation: RotationPolicy;
  clock: Clock;
}

export class RotateCredentialUseCase implements UseCase<RotateCredentialRequest, RotateCredentialResult> {
  readonly #deps: RotateCredentialDependencies;

  constructor(deps: RotateCredentialDependencies) {
    this.#deps = deps;
  }

  async execute(request: RotateCredentialRequest): Promise<RotateCredentialResult> {
    const { scoped, merchants, minter, rotation, clock } = this.#deps;
    const found = await scoped.find(request.actor, request.merchantId);
    if (!found.ok) return found;
    const merchant = found.value;
    const now = clock.now();
    const hadOne = merchant.credentialsOf(request.kind, now).length > 0;
    const minted = await minter.mint(request.kind);
    const secret = request.kind === "signing" ? minted.value : undefined;
    const credential = Merchant.credential(request.kind, minted.fingerprint, now, secret);
    const rotated = merchant.rotated(
      credential,
      { graceMs: request.graceMs, maxGraceMs: await rotation.maxGraceMs() },
      now,
    );
    if (!rotated.ok) return fail(rotated.error);
    const updated = await merchants.update(rotated.value);
    if (!updated.ok) return fail(updated.error);
    return ok({
      merchant: rotated.value,
      kind: request.kind,
      value: minted.value,
      issuedAt: now,
      ...(hadOne ? { previousExpiresAt: new Date(now.getTime() + request.graceMs) } : {}),
    });
  }
}
