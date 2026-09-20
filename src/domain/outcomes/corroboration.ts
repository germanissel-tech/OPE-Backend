// Corroboration (02 §5.1 mechanism B; ADR-028): what the SDK saw on the purchase confirmation
// page. Evidence, never authority: it neither creates nor attributes an order. Its one rule is
// the clock guard the events share: a browser ahead of the server beyond the tolerance is a
// clock error.
import {
  CLOCK_SKEW_TOLERANCE_MS,
  fail,
  ok,
  type MerchantId,
  type Result,
  type SessionId,
  type VisitorId,
} from "../shared-kernel/index.js";
import { CorroborationConfirmedInFuture } from "./errors.js";
import type { OrderId } from "./ids.js";

export interface CorroborationRecord {
  merchantId: MerchantId;
  orderId: OrderId;
  sessionId: SessionId;
  visitorId: VisitorId;
  /** According to the browser. */
  confirmedAt: Date;
  receivedAt: Date;
}

export class Corroboration implements CorroborationRecord {
  readonly merchantId: MerchantId;
  readonly orderId: OrderId;
  readonly sessionId: SessionId;
  readonly visitorId: VisitorId;
  readonly confirmedAt: Date;
  readonly receivedAt: Date;

  private constructor(record: CorroborationRecord) {
    this.merchantId = record.merchantId;
    this.orderId = record.orderId;
    this.sessionId = record.sessionId;
    this.visitorId = record.visitorId;
    this.confirmedAt = record.confirmedAt;
    this.receivedAt = record.receivedAt;
  }

  static of(record: CorroborationRecord): Result<Corroboration, CorroborationConfirmedInFuture> {
    if (record.confirmedAt.getTime() > record.receivedAt.getTime() + CLOCK_SKEW_TOLERANCE_MS) {
      return fail(new CorroborationConfirmedInFuture(CLOCK_SKEW_TOLERANCE_MS));
    }
    return ok(new Corroboration(record));
  }

  static rehydrate(record: CorroborationRecord): Corroboration {
    return new Corroboration(record);
  }
}
