// Public API of the outcomes module (domain): orders, returns and corroborations — the
// VERIFIED_ORDER, ATTRIBUTED_ORDER, PENDING_CORRELATION and RETURNED states of the evidence
// chain (01 §5, ADR-028).
export { asOrderId } from "./ids.js";
export { CONFIRMATION_TOLERANCE_MS, Order, Return } from "./order.js";
export type { OrderFacts, OrderItem, OrderRecord, OrderStatus, ReturnRecord } from "./order.js";
export { Correlation, IncentiveRedemption, REDEMPTION_VERDICTS } from "./correlation.js";
export type {
  CorrelationRecord,
  Granted,
  IncentiveRedemptionRecord,
  RedemptionVerdict,
} from "./correlation.js";
export { Corroboration } from "./corroboration.js";
export type { CorroborationRecord } from "./corroboration.js";
export type { OrderId } from "./ids.js";
export {
  CorroborationConfirmedInFuture,
  DuplicateOrderItem,
  OrderConfirmedInFuture,
  OrderUnknown,
  ReturnItemsNotInOrder,
} from "./errors.js";
export type { OutcomesError } from "./errors.js";
