// deactivateMerchant (ADR-031): terminal. Every credential stops resolving; every record of the
// merchant stays. Repeating it changes nothing.
import {
  fail,
  ok,
  type MerchantId,
  type Result,
  type StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import type { Merchant, MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { UseCase } from "../../shared-kernel/index.js";
import type { MerchantStore } from "../ports/merchant-store.js";
import type { ScopedMerchantService } from "../services/scoped-merchant.service.js";

export interface DeactivateMerchantRequest {
  actor: Operator;
  merchantId: MerchantId;
}

export type DeactivateMerchantResponse = Result<
  Merchant,
  MerchantOutOfScope | MerchantNotFound | StoreUnavailable
>;

export interface DeactivateMerchantDependencies {
  scoped: ScopedMerchantService;
  merchants: MerchantStore;
}

export class DeactivateMerchantUseCase implements UseCase<
  DeactivateMerchantRequest,
  DeactivateMerchantResponse
> {
  readonly #deps: DeactivateMerchantDependencies;

  constructor(deps: DeactivateMerchantDependencies) {
    this.#deps = deps;
  }

  async execute(request: DeactivateMerchantRequest): Promise<DeactivateMerchantResponse> {
    const found = await this.#deps.scoped.find(request.actor, request.merchantId);
    if (!found.ok) return found;
    const deactivated = found.value.deactivated();
    const updated = await this.#deps.merchants.update(deactivated);
    return updated.ok ? ok(deactivated) : fail(updated.error);
  }
}
