// Order (01 §5, §6, §10.3; 02 §5.2; ADR-028): a purchase the merchant's platform confirmed,
// bounded by design to what OPE needs — identifier, total, lines, instant, the OPE session
// the storefront attached and the incentive applied. Every recorded order is a verified sale;
// its correlation with a session is decided once, when it is recorded, and never re-judged.
import {
  CLOCK_SKEW_TOLERANCE_MS,
  fail,
  ok,
  type Incentive,
  type MerchantId,
  type Money,
  type Result,
  type SessionId,
} from "../shared-kernel/index.js";
import {
  DuplicateOrderItem,
  OrderConfirmedInFuture,
  ReturnItemsNotInOrder,
  type OutcomesError,
} from "./errors.js";
import type { Correlation, IncentiveRedemption } from "./correlation.js";
import type { OrderId } from "./ids.js";

/** A line of an order or of a return: SKU and quantity only. */
export interface OrderItem {
  sku: string;
  quantity: number;
}

/** Where the order stands in the evidence chain; replica of `OrderStatus.yaml`. */
export type OrderStatus = "ATTRIBUTED_ORDER" | "PENDING_CORRELATION";

/** What the platform sent, as the domain reads it. */
export interface OrderFacts {
  merchantId: MerchantId;
  orderId: OrderId;
  total: Money;
  items: readonly OrderItem[];
  confirmedAt: Date;
  sessionId?: SessionId | undefined;
  /** The incentive the platform applied at the checkout, when it declares one. */
  declared?: Incentive | undefined;
  receivedAt: Date;
}

/** The facts plus what OPE derived when it recorded them. */
export interface OrderRecord extends OrderFacts {
  correlation?: Correlation | undefined;
  redemption?: IncentiveRedemption | undefined;
  returned?: Return | undefined;
}

export class Order implements OrderRecord {
  readonly merchantId: MerchantId;
  readonly orderId: OrderId;
  readonly total: Money;
  readonly items: readonly OrderItem[];
  readonly confirmedAt: Date;
  readonly sessionId?: SessionId;
  readonly declared?: Incentive;
  readonly receivedAt: Date;
  readonly correlation?: Correlation;
  readonly redemption?: IncentiveRedemption;
  readonly returned?: Return;

  private constructor(record: OrderRecord) {
    this.merchantId = record.merchantId;
    this.orderId = record.orderId;
    this.total = record.total;
    this.items = [...record.items];
    this.confirmedAt = record.confirmedAt;
    if (record.sessionId !== undefined) this.sessionId = record.sessionId;
    if (record.declared !== undefined) this.declared = record.declared;
    this.receivedAt = record.receivedAt;
    if (record.correlation !== undefined) this.correlation = record.correlation;
    if (record.redemption !== undefined) this.redemption = record.redemption;
    if (record.returned !== undefined) this.returned = record.returned;
  }

  /**
   * An order as the platform sent it: no SKU repeats and the confirmation is not ahead of the
   * clock beyond the tolerance. What the schema already guarantees (a line at least, integer
   * quantities) is not re-judged.
   */
  static of(record: OrderRecord): Result<Order, OutcomesError> {
    const duplicate = Order.duplicatedSku(record.items);
    if (duplicate !== undefined) return fail(new DuplicateOrderItem(duplicate));
    if (record.confirmedAt.getTime() > record.receivedAt.getTime() + CLOCK_SKEW_TOLERANCE_MS) {
      return fail(new OrderConfirmedInFuture(CLOCK_SKEW_TOLERANCE_MS));
    }
    return ok(new Order(record));
  }

  /** The duplicated SKU of a list of lines, if any (orders and returns share the rule). */
  static duplicatedSku(items: readonly OrderItem[]): string | undefined {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.sku)) return item.sku;
      seen.add(item.sku);
    }
    return undefined;
  }

  /** The lines by SKU, for equality: their order does not matter. */
  static canonicalItems(items: readonly OrderItem[]): OrderItem[] {
    return items
      .map((i) => ({ sku: i.sku, quantity: i.quantity }))
      .sort((a, b) => a.sku.localeCompare(b.sku));
  }

  /** An order a ledger recorded: its facts are not re-judged. */
  static rehydrate(record: OrderRecord): Order {
    return new Order(record);
  }

  status(): OrderStatus {
    return this.correlation === undefined ? "PENDING_CORRELATION" : "ATTRIBUTED_ORDER";
  }

  /** The same order, returned. */
  withReturn(returned: Return): Order {
    return new Order({ ...this.record(), returned });
  }

  /** The record as a ledger would store it; what was never set is undefined. */
  record(): OrderRecord {
    return {
      merchantId: this.merchantId,
      orderId: this.orderId,
      total: this.total,
      items: this.items,
      confirmedAt: this.confirmedAt,
      sessionId: this.sessionId,
      declared: this.declared,
      receivedAt: this.receivedAt,
      correlation: this.correlation,
      redemption: this.redemption,
      returned: this.returned,
    };
  }

  /** Whether the order has that SKU with at least that many units. */
  contains(item: OrderItem): boolean {
    return this.items.some((line) => line.sku === item.sku && line.quantity >= item.quantity);
  }

  /** What the platform sent, whatever the instants and whatever OPE derived: the identity of a repeat. */
  sameContentAs(other: Order): boolean {
    return contentKey(this) === contentKey(other);
  }
}

/** A canonical text of what the platform sent. */
function contentKey(order: OrderFacts): string {
  return JSON.stringify([
    order.orderId,
    order.total.amount,
    order.total.currency,
    Order.canonicalItems(order.items),
    order.confirmedAt.getTime(),
    order.sessionId ?? null,
    order.declared === undefined ? null : [order.declared.kind, order.declared.value],
  ]);
}

// Return (02 §5.4; ADR-028): a recorded order came back. Items are informative — the MVP
// measures purchase quality per order (03 §4.7) — but a return cannot contain what the order
// did not. One return per order. It lives with the order: the two refer to each other.
export interface ReturnRecord {
  orderId: OrderId;
  returnedAt: Date;
  items?: readonly OrderItem[] | undefined;
  receivedAt: Date;
}

export class Return implements ReturnRecord {
  readonly orderId: OrderId;
  readonly returnedAt: Date;
  readonly items?: readonly OrderItem[];
  readonly receivedAt: Date;

  private constructor(record: ReturnRecord) {
    this.orderId = record.orderId;
    this.returnedAt = record.returnedAt;
    if (record.items !== undefined) this.items = [...record.items];
    this.receivedAt = record.receivedAt;
  }

  /** A return of that order: every line returned is a line of the order, with no more units than bought, and no SKU repeats. */
  static of(order: Order, record: Omit<ReturnRecord, "orderId">): Result<Return, ReturnItemsNotInOrder> {
    const items = record.items ?? [];
    const duplicate = Order.duplicatedSku(items);
    if (duplicate !== undefined) return fail(new ReturnItemsNotInOrder(order.orderId, duplicate));
    const stranger = items.find((item) => !order.contains(item));
    if (stranger !== undefined) return fail(new ReturnItemsNotInOrder(order.orderId, stranger.sku));
    return ok(new Return({ ...record, orderId: order.orderId }));
  }

  /** A return a ledger recorded: its facts are not re-judged. */
  static rehydrate(record: ReturnRecord): Return {
    return new Return(record);
  }

  /** What the platform sent, whatever the instant OPE received it: the identity of a repeat. */
  sameContentAs(other: Return): boolean {
    return returnKey(this) === returnKey(other);
  }
}

function returnKey(returned: ReturnRecord): string {
  return JSON.stringify([
    returned.orderId,
    returned.returnedAt.getTime(),
    returned.items === undefined ? null : Order.canonicalItems(returned.items),
  ]);
}
