// Use case: the platform confirms an order (mechanism A, 02 §5.2; ADR-028). The order is built
// by its factory, correlated with what the ledger knows of the session it carries (nothing is
// inferred), crossed with the incentive the session granted, and recorded: the ledger decides
// first / repeat / conflict atomically. A recorded order never changes; a repeat answers the
// original record.
import {
  Correlation,
  IncentiveRedemption,
  Order,
  type OrderId,
  type OrderItem,
  type OutcomesError,
} from "../../../domain/outcomes/index.js";
import {
  fail,
  IdempotencyConflict,
  ok,
  type Incentive,
  type MerchantId,
  type Money,
  type Result,
  type SessionId,
} from "../../../domain/shared-kernel/index.js";
import type { Decision, LedgerUnavailable } from "../../../domain/ledger/index.js";
import type { DecisionLedger } from "../../ledger/index.js";
import type { Clock, Logger, UseCase } from "../../shared-kernel/index.js";
import type { CorroborationLedger } from "../ports/corroboration-ledger.js";
import type { OrderLedger } from "../ports/order-ledger.js";

export interface NotifyOrderRequest {
  merchantId: MerchantId;
  orderId: OrderId;
  total: Money;
  items: readonly OrderItem[];
  confirmedAt: Date;
  sessionId?: SessionId | undefined;
  incentive?: Incentive | undefined;
}

export interface OrderNotified {
  order: Order;
  /** `created` on the first receipt; `repeated` when the same order came again. */
  outcome: "created" | "repeated";
}

export type NotifyOrderResponse = Result<
  OrderNotified,
  OutcomesError | IdempotencyConflict | LedgerUnavailable
>;

export interface NotifyOrderDependencies {
  clock: Clock;
  orders: OrderLedger;
  decisions: DecisionLedger;
  corroborations: CorroborationLedger;
  logger: Logger;
}

export class NotifyOrderUseCase implements UseCase<NotifyOrderRequest, NotifyOrderResponse> {
  readonly #deps: NotifyOrderDependencies;

  constructor(deps: NotifyOrderDependencies) {
    this.#deps = deps;
  }

  async execute(request: NotifyOrderRequest): Promise<NotifyOrderResponse> {
    const { clock, orders, decisions, corroborations, logger } = this.#deps;
    const receivedAt = clock.now();
    const facts = {
      merchantId: request.merchantId,
      orderId: request.orderId,
      total: request.total,
      items: request.items,
      confirmedAt: request.confirmedAt,
      sessionId: request.sessionId,
      declared: request.incentive,
      receivedAt,
    };
    const built = Order.of(facts);
    if (!built.ok) return fail(built.error);
    const known: readonly Decision[] =
      request.sessionId === undefined ? [] : await decisions.bySession(request.merchantId, request.sessionId);
    const correlation =
      request.sessionId === undefined ? undefined : Correlation.of(request.sessionId, known);
    const redemption = IncentiveRedemption.of(request.incentive, correlation !== undefined, known);
    const order = Order.rehydrate({ ...built.value.record(), correlation, redemption });
    const recorded = await orders.record(order);
    if (!recorded.ok) return fail(recorded.error);
    const { outcome, order: kept } = recorded.value;
    if (outcome === "conflict") return fail(new IdempotencyConflict(`Order ${request.orderId}`));
    if (outcome === "recorded") {
      const corroborated = (await corroborations.find(request.merchantId, request.orderId)).length > 0;
      logger.info(
        {
          merchantId: request.merchantId,
          orderId: request.orderId,
          status: kept.status(),
          ...(kept.redemption === undefined ? {} : { redemption: kept.redemption.verdict }),
          corroborated,
        },
        "order recorded",
      );
    }
    return ok({ order: kept, outcome: outcome === "recorded" ? "created" : "repeated" });
  }
}
