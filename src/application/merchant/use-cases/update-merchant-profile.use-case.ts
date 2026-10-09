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
}

export type UpdateMerchantProfileResponse = Result<
  Merchant,
  MerchantOutOfScope | MerchantNotFound | InvalidMerchantProfile | StoreUnavailable
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
    const updated = found.value.withProfile(profile.value);
    const written = await this.#deps.merchants.update(updated);
    return written.ok ? ok(updated) : fail(written.error);
  }
}
