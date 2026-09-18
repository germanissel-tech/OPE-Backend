// US2 (FR-015, FR-052; ADR-007) and ADR-024: batch invariants, enforced by construction; the
// provisional NO_OP reason of a batch while there is no decision plane.
import { describe, expect, it } from "vitest";
import {
  EventBatch,
  NO_OP_REASONS,
  TIMESTAMP_TOLERANCE,
  type Event,
  type PageContext,
  type ProductViewed,
} from "../../../../src/domain/ingestion/index.js";
import { asEventId, asSessionId, asVisitorId } from "../../../../src/domain/shared-kernel/index.js";

const MIN = 60_000;
const HOUR = 60 * MIN;
const now = new Date("2026-09-16T12:00:00.000Z");
const at = (offsetMs: number): Date => new Date(now.getTime() + offsetMs);

const event = (n: number, over: Partial<ProductViewed> = {}): Event => ({
  type: "product_viewed",
  eventId: asEventId(`evt_${String(n).padStart(8, "0")}`),
  sessionId: asSessionId("ses_00000001"),
  visitorId: asVisitorId("vis_00000001"),
  occurredAt: now,
  page: { pageType: "product", productId: "SKU-1" },
  device: "mobile",
  ...over,
});

function batchOf(events: Event[]): EventBatch {
  const built = EventBatch.of(events, now);
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

describe("EventBatch.of", () => {
  it("a batch of one session, one visitor and instants within tolerance exists and exposes its facts", () => {
    const batch = batchOf([event(1), event(2), event(3)]);
    expect(batch.sessionId).toBe("ses_00000001");
    expect(batch.visitorId).toBe("vis_00000001");
    expect(batch.eventIds()).toEqual(["evt_00000001", "evt_00000002", "evt_00000003"]);
    expect(batch.events).toHaveLength(3);
  });

  it("a batch of a single event exists", () => {
    expect(EventBatch.of([event(1)], now).ok).toBe(true);
  });

  it("an empty batch is a programming error: the contract requires at least one event", () => {
    expect(() => EventBatch.of([], now)).toThrow("at least one event");
  });

  it("[invariant:session-visitor-mismatch] two visitors in the same batch → rejected", () => {
    const result = EventBatch.of([event(1), event(2, { visitorId: asVisitorId("vis_00000002") })], now);
    expect(result).toMatchObject({ ok: false, error: { code: "session-visitor-mismatch" } });
    if (!result.ok) expect(result.error.message).toContain("evt_00000002");
  });

  it("[invariant:session-visitor-mismatch] two sessions in the same batch → rejected", () => {
    const result = EventBatch.of([event(1), event(2, { sessionId: asSessionId("ses_00000002") })], now);
    expect(result).toMatchObject({ ok: false, error: { code: "session-visitor-mismatch" } });
  });

  it("[invariant:event-timestamp-out-of-range] timestamp out of tolerance → rejected", () => {
    const future = EventBatch.of([event(1, { occurredAt: at(5 * MIN + 1) })], now);
    expect(future).toMatchObject({ ok: false, error: { code: "event-timestamp-out-of-range" } });
    const past = EventBatch.of([event(1, { occurredAt: at(-24 * HOUR - 1) })], now);
    expect(past).toMatchObject({ ok: false, error: { code: "event-timestamp-out-of-range" } });
  });

  it("the tolerance is the one the contract publishes: 24 h behind, 5 min ahead", () => {
    expect(TIMESTAMP_TOLERANCE).toEqual({ pastMs: 24 * HOUR, futureMs: 5 * MIN });
  });

  it("the edges of the tolerance are inside: exactly 5 min ahead and exactly 24 h behind", () => {
    expect(EventBatch.of([event(1, { occurredAt: at(5 * MIN) })], now).ok).toBe(true);
    expect(EventBatch.of([event(1, { occurredAt: at(-24 * HOUR) })], now).ok).toBe(true);
  });

  it("the first violated invariant wins: session mix before timestamp", () => {
    const result = EventBatch.of(
      [event(1), event(2, { sessionId: asSessionId("ses_00000002"), occurredAt: at(-48 * HOUR) })],
      now,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "session-visitor-mismatch" } });
  });
});

describe("EventBatch.noOpReason (without a decision plane)", () => {
  const viewed = (page: PageContext, n = 1): Event => event(n, { page });

  it("product page without productId in any event → page-context-incomplete", () => {
    expect(batchOf([viewed({ pageType: "product" })]).noOpReason()).toBe("page-context-incomplete");
  });

  it("product page with productId → decision-plane-unavailable", () => {
    expect(batchOf([viewed({ pageType: "product", productId: "SKU-1" })]).noOpReason()).toBe(
      "decision-plane-unavailable",
    );
  });

  it("one product-page event with a resolved product is enough", () => {
    const batch = batchOf([
      viewed({ pageType: "product" }, 1),
      viewed({ pageType: "product", productId: "SKU-1" }, 2),
    ]);
    expect(batch.noOpReason()).toBe("decision-plane-unavailable");
  });

  it("every reason a batch can give is in the catalogue", () => {
    for (const page of [{ pageType: "product" as const }, { pageType: "listing" as const }]) {
      expect(NO_OP_REASONS).toContain(batchOf([viewed(page)]).noOpReason());
    }
  });

  it("a batch without a product page (listing only) → decision-plane-unavailable", () => {
    expect(batchOf([viewed({ pageType: "listing" })]).noOpReason()).toBe("decision-plane-unavailable");
  });
});
