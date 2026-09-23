// What every administration use case on one merchant does first (ADR-031): judge the scope of
// the operator — before the store, so nothing outside the scope is revealed — and fetch the
// merchant, which is not found only inside the scope.
import { MerchantNotFound, type Merchant } from "../../../domain/merchant/index.js";
import { fail, ok, type MerchantId, type Result } from "../../../domain/shared-kernel/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { MerchantStore } from "../ports/merchant-store.js";

export type ScopedMerchant = Result<Merchant, MerchantOutOfScope | MerchantNotFound>;

export interface ScopedMerchantService {
  find(actor: Operator, merchantId: MerchantId): Promise<ScopedMerchant>;
}

export interface ScopedMerchantServiceDependencies {
  merchants: MerchantStore;
}

export class ScopedMerchants implements ScopedMerchantService {
  readonly #deps: ScopedMerchantServiceDependencies;

  constructor(deps: ScopedMerchantServiceDependencies) {
    this.#deps = deps;
  }

  async find(actor: Operator, merchantId: MerchantId): Promise<ScopedMerchant> {
    const scoped = actor.scopeFor(merchantId);
    if (!scoped.ok) return scoped;
    const merchant = await this.#deps.merchants.get(scoped.value);
    return merchant === undefined ? fail(new MerchantNotFound()) : ok(merchant);
  }
}
