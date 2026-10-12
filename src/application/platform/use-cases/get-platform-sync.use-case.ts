// getMerchantPlatformSync (feature 044; research R-10): where the reading of each flow of a merchant stands,
// next to the mode that governs it, within the operator's scope. A flow that never ran has no state, and that
// is "never ran", not a failure.
import {
  ok,
  type MerchantId,
  type Result,
  type SyncFlow,
  type SyncMode,
} from "../../../domain/shared-kernel/index.js";
import type { MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { PlatformSourceName, SyncState } from "../../../domain/platform/index.js";
import type { ScopedMerchantService } from "../../merchant/index.js";
import type { UseCase } from "../../shared-kernel/index.js";
import type { PlatformPolicies } from "../ports/platform-policies.js";
import type { SyncStateStore } from "../ports/sync-state-store.js";

export interface GetPlatformSyncRequest {
  actor: Operator;
  merchantId: MerchantId;
}

export interface FlowSync {
  mode: SyncMode;
  state: SyncState;
}

export interface PlatformSyncView {
  source: PlatformSourceName;
  flows: Readonly<Record<SyncFlow, FlowSync>>;
}

export type GetPlatformSyncResponse = Result<PlatformSyncView, MerchantOutOfScope | MerchantNotFound>;

export interface GetPlatformSyncDependencies {
  scoped: ScopedMerchantService;
  policies: PlatformPolicies;
  states: SyncStateStore;
}

export class GetPlatformSyncUseCase implements UseCase<GetPlatformSyncRequest, GetPlatformSyncResponse> {
  readonly #deps: GetPlatformSyncDependencies;

  constructor(deps: GetPlatformSyncDependencies) {
    this.#deps = deps;
  }

  async execute(request: GetPlatformSyncRequest): Promise<GetPlatformSyncResponse> {
    const found = await this.#deps.scoped.find(request.actor, request.merchantId);
    if (!found.ok) return found;
    const merchantId = found.value.merchantId;
    const [policy, states] = await Promise.all([
      this.#deps.policies.policyFor(merchantId),
      this.#deps.states.statesOf(merchantId),
    ]);
    const flowOf = (flow: SyncFlow): FlowSync => ({ mode: policy.strategy[flow], state: states[flow] ?? {} });
    return ok({
      source: policy.source,
      flows: {
        catalog: flowOf("catalog"),
        stockAndPrice: flowOf("stockAndPrice"),
        orders: flowOf("orders"),
        returns: flowOf("returns"),
      },
    });
  }
}
