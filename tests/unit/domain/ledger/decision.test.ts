// US3 (FR-020, FR-021): the decision always exists, with a reason; without a decision plane it is NO_OP.
import { describe, expect, it } from "vitest";
import { decide, type Event, type PageContext } from "../../../../src/domain/ingestion/index.js";
import { noOp } from "../../../../src/domain/ledger/index.js";
import {
  asDecisionId,
  asEventId,
  asMerchantId,
  asSessionId,
  asVisitorId,
} from "../../../../src/domain/shared-kernel/index.js";

const now = new Date("2026-09-16T12:00:00.000Z");
const viewed = (page: PageContext): Event => ({
  type: "product_viewed",
  eventId: asEventId("evt_00000001"),
  sessionId: asSessionId("ses_00000001"),
  visitorId: asVisitorId("vis_00000001"),
  occurredAt: now,
  page,
  device: "desktop",
});

describe("noOp", () => {
  it("produces a NO_OP decision without intervention, with everything the ledger records", () => {
    const decision = noOp({
      decisionId: asDecisionId("dec_00000001"),
      merchantId: asMerchantId("m_a"),
      sessionId: asSessionId("ses_00000001"),
      visitorId: asVisitorId("vis_00000001"),
      decidedAt: now,
      reason: "decision-plane-unavailable",
    });
    expect(decision).toEqual({
      decisionId: "dec_00000001",
      merchantId: "m_a",
      sessionId: "ses_00000001",
      visitorId: "vis_00000001",
      decidedAt: now,
      outcome: "NO_OP",
      reason: "decision-plane-unavailable",
    });
    expect(decision.intervention).toBeUndefined();
  });
});

describe("decide (without a decision plane)", () => {
  it("product page without productId in any event → page-context-incomplete", () => {
    expect(decide({ events: [viewed({ pageType: "product" })] })).toBe("page-context-incomplete");
  });

  it("product page with productId → decision-plane-unavailable", () => {
    expect(decide({ events: [viewed({ pageType: "product", productId: "SKU-1" })] })).toBe(
      "decision-plane-unavailable",
    );
  });

  it("one product-page event with a resolved product is enough", () => {
    const events = [viewed({ pageType: "product" }), viewed({ pageType: "product", productId: "SKU-1" })];
    expect(decide({ events })).toBe("decision-plane-unavailable");
  });

  it("a batch without a product page (listing only) → decision-plane-unavailable", () => {
    expect(decide({ events: [viewed({ pageType: "listing" })] })).toBe("decision-plane-unavailable");
  });
});
