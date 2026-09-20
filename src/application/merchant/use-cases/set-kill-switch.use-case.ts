// setKillSwitch (01 §14.2, ADR-031): on or off, without a deploy; effective on the next request.
// Off, the merchant decides nothing and still measures (the decision plane reads `isOn`).
import {
  fail,
  ok,
  type MerchantId,
  type Result,
  type StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import type { Merchant, MerchantDeactivated, MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { UseCase } from "../../shared-kernel/index.js";
import type { MerchantStore } from "../ports/merchant-store.js";
import type { ScopedMerchantService } from "../services/scoped-merchant.service.js";

export interface SetKillSwitchRequest {
  actor: Operator;
  merchantId: MerchantId;
  enabled: boolean;
}

export type SetKillSwitchResponse = Result<
  Merchant,
  MerchantOutOfScope | MerchantNotFound | MerchantDeactivated | StoreUnavailable
>;

export interface SetKillSwitchDependencies {
  scoped: ScopedMerchantService;
  merchants: MerchantStore;
}

export class SetKillSwitchUseCase implements UseCase<SetKillSwitchRequest, SetKillSwitchResponse> {
  readonly #deps: SetKillSwitchDependencies;

  constructor(deps: SetKillSwitchDependencies) {
    this.#deps = deps;
  }

  async execute(request: SetKillSwitchRequest): Promise<SetKillSwitchResponse> {
    const found = await this.#deps.scoped.find(request.actor, request.merchantId);
    if (!found.ok) return found;
    const switched = found.value.switched(request.enabled);
    if (!switched.ok) return switched;
    const updated = await this.#deps.merchants.update(switched.value);
    return updated.ok ? ok(switched.value) : fail(updated.error);
  }
}
