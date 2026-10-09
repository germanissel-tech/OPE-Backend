// createMerchant (ADR-031): an operator gives the origins; OPE mints the identifier and the
// credentials — an ingest key, a platform key and, when asked, a signing secret — and answers
// them once. An origin already registered by another merchant is refused: an origin speaks for
// one merchant only.
import {
  Merchant,
  MerchantProfile,
  OriginAlreadyRegistered,
  type InvalidMerchantProfile,
  type InvalidOrigin,
  type InvalidOrigins,
  type MerchantProfileRecord,
} from "../../../domain/merchant/index.js";
import { fail, ok, type Result, type StoreUnavailable } from "../../../domain/shared-kernel/index.js";
import type { Operator } from "../../../domain/operator/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { CredentialMinter } from "../ports/credential-minter.js";
import type { MerchantStore } from "../ports/merchant-store.js";

export interface CreateMerchantRequest {
  actor: Operator;
  origins: readonly string[];
  /** Whether the platform will sign its notifications (ADR-029): mints a signing secret too. */
  signature: boolean;
  /** The identity for people (ADR-045); the contract makes `displayName` mandatory at creation. */
  profile: MerchantProfileRecord;
}

/** The merchant and the values of its credentials: the only time they travel. */
export interface CreateMerchantResponse {
  merchant: Merchant;
  ingestKey: string;
  platformKey: string;
  platformSecret?: string | undefined;
}

/** What creation can refuse: an origin that is not one, or one that belongs to another merchant; a store down. */
export type CreateMerchantFailure =
  InvalidOrigin | InvalidOrigins | InvalidMerchantProfile | OriginAlreadyRegistered | StoreUnavailable;

export interface CreateMerchantDependencies {
  merchants: MerchantStore;
  minter: CredentialMinter;
  clock: Clock;
}

export class CreateMerchantUseCase implements UseCase<
  CreateMerchantRequest,
  Result<CreateMerchantResponse, CreateMerchantFailure>
> {
  readonly #deps: CreateMerchantDependencies;

  constructor(deps: CreateMerchantDependencies) {
    this.#deps = deps;
  }

  async execute(
    request: CreateMerchantRequest,
  ): Promise<Result<CreateMerchantResponse, CreateMerchantFailure>> {
    const { merchants, minter, clock } = this.#deps;
    const origins = Merchant.judgeOrigins(request.origins);
    if (!origins.ok) return origins;
    // Judged before asking the store or minting anything: a refused identity leaves nothing behind.
    const profile = MerchantProfile.of(request.profile);
    if (!profile.ok) return profile;
    for (const [index, origin] of request.origins.entries()) {
      if ((await merchants.ownerOfOrigin(origin)) !== undefined)
        return fail(new OriginAlreadyRegistered(index));
    }
    const now = clock.now();
    const ingest = await minter.mint("ingest");
    const platform = await minter.mint("platform");
    const signing = request.signature ? await minter.mint("signing") : undefined;
    const credentials = [
      Merchant.credential("ingest", ingest.fingerprint, now),
      Merchant.credential("platform", platform.fingerprint, now),
      ...(signing === undefined
        ? []
        : [Merchant.credential("signing", signing.fingerprint, now, signing.value)]),
    ];
    const merchant = Merchant.of({
      merchantId: await minter.mintMerchantId(),
      origins: request.origins,
      credentials,
      createdAt: now,
      profile: profile.value,
    });
    // The origins were judged above and the credentials were just minted: a rejection here is a bug.
    if (!merchant.ok) throw new Error(`A freshly minted merchant was rejected: ${merchant.error.code}.`);
    const created = await merchants.create(merchant.value);
    if (!created.ok) return fail(created.error);
    return ok({
      merchant: merchant.value,
      ingestKey: ingest.value,
      platformKey: platform.value,
      ...(signing === undefined ? {} : { platformSecret: signing.value }),
    });
  }
}
