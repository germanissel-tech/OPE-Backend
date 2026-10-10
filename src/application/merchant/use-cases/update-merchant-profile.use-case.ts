// updateMerchantProfile (ADR-045): the identity of a merchant, replaced whole by an operator with
// scope over it. Origins, status and credentials have use cases of their own and are not touched.
import {
  MerchantProfile,
  type InvalidMerchantProfile,
  type Merchant,
  type MerchantNotFound,
  type MerchantProfileRecord,
} from "../../../domain/merchant/index.js";
import {
  fail,
  ok,
  StaleVersion,
  type MerchantId,
  type Result,
  type StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { UseCase } from "../../shared-kernel/index.js";
import type { MerchantStore } from "../ports/merchant-store.js";
import type { ScopedMerchantService } from "../services/scoped-merchant.service.js";

export interface UpdateMerchantProfileRequest {
  actor: Operator;
  merchantId: MerchantId;
  profile: MerchantProfileRecord;
  /**
   * The witness of the merchant as the caller read it (feature 043, ADR-046). The edition replaces the whole
   * identity with what the caller read and changed, so it is accepted only if nothing wrote the merchant since
   * — any write: the switch, a rotation and the deactivation move the witness too.
   */
  witness: string;
}

export type UpdateMerchantProfileResponse = Result<
  Merchant,
  MerchantOutOfScope | MerchantNotFound | InvalidMerchantProfile | StaleVersion | StoreUnavailable
>;

export interface UpdateMerchantProfileDependencies {
  scoped: ScopedMerchantService;
  merchants: MerchantStore;
}

export class UpdateMerchantProfileUseCase implements UseCase<
  UpdateMerchantProfileRequest,
  UpdateMerchantProfileResponse
> {
  readonly #deps: UpdateMerchantProfileDependencies;

  constructor(deps: UpdateMerchantProfileDependencies) {
    this.#deps = deps;
  }

  async execute(request: UpdateMerchantProfileRequest): Promise<UpdateMerchantProfileResponse> {
    const found = await this.#deps.scoped.find(request.actor, request.merchantId);
    if (!found.ok) return found;
    const profile = MerchantProfile.of(request.profile);
    if (!profile.ok) return profile;
    // An identity identical to the one it has overwrites nothing: the retry of an edition that went through
    // answers the merchant as it is, whatever witness it carries, and writes nothing — so the revision does
    // not move for a retry (ADR-046). After the scope, so the witness never tells about a merchant outside it.
    if (profile.value.sameAs(found.value.profile)) return ok(found.value);
    if (found.value.witness() !== request.witness) return fail(new StaleVersion());
    const updated = found.value.withProfile(profile.value);
    const written = await this.#deps.merchants.update(updated);
    return written.ok ? ok(updated) : fail(written.error);
  }
}
