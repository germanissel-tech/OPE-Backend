// Business errors of the outcomes module (ADR-023). Codes are the Problem Details slugs of
// contracts/problem-types.yaml; the replica test keeps both in step.
import { DomainError } from "../shared-kernel/index.js";

const MODULE = "outcomes" as const;
const AHEAD_OF_CLOCK = "confirmedAt is more than 5 minutes ahead of the server clock.";

export class DuplicateOrderItem extends DomainError {
  readonly code = "duplicate-order-item" as const;
  readonly module = MODULE;
  constructor(sku: string) {
    super(`${sku} appears twice in the order.`);
  }
}

export class OrderConfirmedInFuture extends DomainError {
  readonly code = "order-confirmed-in-future" as const;
  readonly module = MODULE;
  constructor() {
    super(AHEAD_OF_CLOCK);
  }
}

export class CorroborationConfirmedInFuture extends DomainError {
  readonly code = "corroboration-confirmed-in-future" as const;
  readonly module = MODULE;
  constructor() {
    super(AHEAD_OF_CLOCK);
  }
}

/** Nonexistent or of another merchant: the same answer, nothing revealed. */
export class OrderUnknown extends DomainError {
  readonly code = "order-unknown" as const;
  readonly module = MODULE;
  constructor(orderId: string) {
    super(`No order ${orderId} has been notified for this merchant; notify the order first.`);
  }
}

export class ReturnItemsNotInOrder extends DomainError {
  readonly code = "return-items-not-in-order" as const;
  readonly module = MODULE;
  constructor(orderId: string, sku: string) {
    super(`${sku} is not in order ${orderId}, or more units than bought.`);
  }
}

export type OutcomesError =
  | DuplicateOrderItem
  | OrderConfirmedInFuture
  | CorroborationConfirmedInFuture
  | OrderUnknown
  | ReturnItemsNotInOrder;
