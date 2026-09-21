// Use case: the SDK corroborates a purchase from the confirmation page (mechanism B, 02 §5.1;
// ADR-028). Evidence only: recorded under the credential's merchant, never creates nor
// attributes an order; repeating it is harmless. A ledger that cannot record answers
// LedgerUnavailable and the SDK retries (ADR-021).
import {
  Corroboration,
  type CorroborationConfirmedInFuture,
  type OrderId,
} from "../../../domain/outcomes/index.js";
import {
  fail,
  ok,
  type MerchantId,
  type Result,
  type SessionId,
  type VisitorId,
} from "../../../domain/shared-kernel/index.js";
import type { LedgerUnavailable } from "../../../domain/ledger/index.js";
import type { Clock, ClockTolerance, UseCase } from "../../shared-kernel/index.js";
import type { CorroborationLedger, CorroborationRecordStatus } from "../ports/corroboration-ledger.js";

export interface CorroborateOrderRequest {
  merchantId: MerchantId;
  orderId: OrderId;
  sessionId: SessionId;
  visitorId: VisitorId;
  confirmedAt: Date;
}

export interface OrderCorroborated {
  receivedAt: Date;
  status: CorroborationRecordStatus;
}

export type CorroborateOrderResponse = Result<
  OrderCorroborated,
  CorroborationConfirmedInFuture | LedgerUnavailable
>;

export interface CorroborateOrderDependencies {
  clock: Clock;
  tolerance: ClockTolerance;
  corroborations: CorroborationLedger;
}

export class CorroborateOrderUseCase implements UseCase<CorroborateOrderRequest, CorroborateOrderResponse> {
  readonly #deps: CorroborateOrderDependencies;

  constructor(deps: CorroborateOrderDependencies) {
    this.#deps = deps;
  }

  async execute(request: CorroborateOrderRequest): Promise<CorroborateOrderResponse> {
    const { clock, tolerance, corroborations } = this.#deps;
    const built = Corroboration.of({ ...request, receivedAt: clock.now() }, tolerance.skewMs());
    if (!built.ok) return fail(built.error);
    const recorded = await corroborations.record(built.value);
    if (!recorded.ok) return fail(recorded.error);
    return ok({ receivedAt: built.value.receivedAt, status: recorded.value });
  }
}
