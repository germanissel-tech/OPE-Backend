// getMerchant (ADR-031): the merchant an operator asks for, within the operator's scope.
import type { Merchant, MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { MerchantId, Result } from "../../../domain/shared-kernel/index.js";
import type { UseCase } from "../../shared-kernel/index.js";
import type { ScopedMerchantService } from "../services/scoped-merchant.service.js";

export interface GetMerchantRequest {
  actor: Operator;
  merchantId: MerchantId;
}

export type GetMerchantResponse = Result<Merchant, MerchantOutOfScope | MerchantNotFound>;

export interface GetMerchantDependencies {
  scoped: ScopedMerchantService;
}

export class GetMerchantUseCase implements UseCase<GetMerchantRequest, GetMerchantResponse> {
  readonly #deps: GetMerchantDependencies;

  constructor(deps: GetMerchantDependencies) {
    this.#deps = deps;
  }

  execute(request: GetMerchantRequest): Promise<GetMerchantResponse> {
    return this.#deps.scoped.find(request.actor, request.merchantId);
  }
}
