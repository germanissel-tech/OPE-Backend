// US3 (FR-020, FR-021): la decisión siempre existe, con motivo; sin plano de decisión es NO_OP.
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
  it("produce una decisión NO_OP sin intervención, con todo lo que el ledger registra", () => {
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

describe("decide (sin plano de decisión)", () => {
  it("ficha de producto sin productId en ningún evento → page-context-incomplete", () => {
    expect(decide({ events: [viewed({ pageType: "product" })] })).toBe("page-context-incomplete");
  });

  it("ficha con productId → decision-plane-unavailable", () => {
    expect(decide({ events: [viewed({ pageType: "product", productId: "SKU-1" })] })).toBe(
      "decision-plane-unavailable",
    );
  });

  it("basta un evento de la ficha con producto resuelto", () => {
    const events = [viewed({ pageType: "product" }), viewed({ pageType: "product", productId: "SKU-1" })];
    expect(decide({ events })).toBe("decision-plane-unavailable");
  });

  it("un lote sin ficha de producto (sólo listado) → decision-plane-unavailable", () => {
    expect(decide({ events: [viewed({ pageType: "listing" })] })).toBe("decision-plane-unavailable");
  });
});
