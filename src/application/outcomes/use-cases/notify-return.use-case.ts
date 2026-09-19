// Use case: the platform reports the return of a recorded order (02 §5.4; ADR-028). The order
// must exist for the merchant (an order of another merchant does not); the return is built by
// its factory against the order's lines and the ledger marks the order RETURNED, deciding
// first / repeat / conflict atomically. The order keeps its correlation.
import {
  OrderUnknown,
  Return,
  type Order,
  type OrderId,
  type OrderItem,
  type OutcomesError,
} from "../../../domain/outcomes/index.js";
import {
  fail,
  IdempotencyConflict,
  ok,
  type MerchantId,
  type Result,
} from "../../../domain/shared-kernel/index.js";
import type { LedgerUnavailable } from "../../../domain/ledger/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { OrderLedger } from "../ports/order-ledger.js";

export interface NotifyReturnRequest {
  merchantId: MerchantId;
  orderId: OrderId;
  returnedAt: Date;
  items?: readonly OrderItem[] | undefined;
}

export interface ReturnNotified {
  order: Order;
  outcome: "created" | "repeated";
}

export type NotifyReturnResponse = Result<
  ReturnNotified,
  OutcomesError | IdempotencyConflict | LedgerUnavailable
>;

export interface NotifyReturnDependencies {
  clock: Clock;
  orders: OrderLedger;
}

export class NotifyReturnUseCase implements UseCase<NotifyReturnRequest, NotifyReturnResponse> {
  readonly #deps: NotifyReturnDependencies;

  constructor(deps: NotifyReturnDependencies) {
    this.#deps = deps;
  }

  async execute(request: NotifyReturnRequest): Promise<NotifyReturnResponse> {
    const { clock, orders } = this.#deps;
    const order = await orders.find(request.merchantId, request.orderId);
    if (order === undefined) return fail(new OrderUnknown(request.orderId));
    const built = Return.of(order, {
      returnedAt: request.returnedAt,
      items: request.items,
      receivedAt: clock.now(),
    });
    if (!built.ok) return fail(built.error);
    const recorded = await orders.recordReturn(request.merchantId, request.orderId, built.value);
    if (!recorded.ok) return fail(recorded.error);
    const recording = recorded.value;
    if (recording.outcome === "unknown") return fail(new OrderUnknown(request.orderId));
    if (recording.outcome === "conflict")
      return fail(new IdempotencyConflict(`A return of order ${request.orderId}`));
    return ok({ order: recording.order, outcome: recording.outcome === "recorded" ? "created" : "repeated" });
  }
}
