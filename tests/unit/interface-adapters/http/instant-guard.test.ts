// ADR-024: an unparsable date-time is a programming error caught at the DTO → domain edge (the
// contract validated the format; the domain never sees NaN). Exercised directly on the
// controllers because no request passes the contract with such a value.
import { describe, expect, it } from "vitest";
import { INGEST_KEY_SCHEME } from "../../../../src/interface-adapters/access/index.js";
import { makeUpsertCatalogSnapshot } from "../../../../src/interface-adapters/catalog/controllers/upsert-catalog-snapshot.js";
import { makeIngestEvents } from "../../../../src/interface-adapters/ingestion/controllers/ingest-events.js";
import { makeConfirmExposureHandler } from "../../../../src/interface-adapters/ledger/controllers/confirm-exposure.js";
import { makeCorroborateOrder } from "../../../../src/interface-adapters/outcomes/controllers/corroborate-order.js";
import { makeNotifyOrder } from "../../../../src/interface-adapters/outcomes/controllers/notify-order.js";
import { makeNotifyReturn } from "../../../../src/interface-adapters/outcomes/controllers/notify-return.js";
import { eventOf } from "../../../helpers/test-app.js";

const never = { execute: () => Promise.reject(new Error("the use case must not run")) };
const security = { [INGEST_KEY_SCHEME]: { merchant: { merchantId: "m_a" } } };

describe("date-time guard at the HTTP edge", () => {
  it("ingestEvents refuses an unparsable occurredAt before the use case runs", async () => {
    const handler = makeIngestEvents(never);
    const req = {
      operationId: "ingestEvents" as const,
      instance: "/v1/events",
      path: undefined,
      query: undefined,
      headers: undefined,
      cookie: undefined,
      body: { events: [eventOf(1, { occurredAt: "not a date" })] } as never,
      security,
    };
    await expect(handler(req)).rejects.toThrow("unparsable date-time");
  });

  it("upsertCatalogSnapshot refuses an unparsable capturedAt before the use case runs", async () => {
    const handler = makeUpsertCatalogSnapshot(never);
    const req = {
      operationId: "upsertCatalogSnapshot" as const,
      instance: "/v1/catalog",
      path: undefined,
      query: undefined,
      headers: undefined,
      cookie: undefined,
      body: { capturedAt: "not a date", products: [] } as never,
      security,
    };
    await expect(handler(req)).rejects.toThrow("unparsable date-time");
  });

  it("confirmExposure refuses an unparsable exposedAt before the use case runs", async () => {
    const handler = makeConfirmExposureHandler(never);
    const req = {
      operationId: "confirmExposure" as const,
      instance: "/v1/exposures",
      path: undefined,
      query: undefined,
      headers: undefined,
      cookie: undefined,
      body: {
        decisionId: "dec_00000001",
        sessionId: "ses_00000001",
        visitorId: "vis_00000001",
        exposedAt: "not a date",
        anchor: "variant_selector",
      } as never,
      security,
    };
    await expect(handler(req)).rejects.toThrow("unparsable date-time");
  });

  it("notifyOrder, corroborateOrder and notifyReturn refuse an unparsable instant before the use case runs", async () => {
    const at = (operationId: string, instance: string, body: Record<string, unknown>) => ({
      operationId,
      instance,
      path: undefined,
      query: undefined,
      headers: undefined,
      cookie: undefined,
      body: body as never,
      security,
    });
    const order = {
      orderId: "A-1",
      total: { amount: "1.00", currency: "ARS" },
      items: [{ sku: "s", quantity: 1 }],
    };
    await expect(
      makeNotifyOrder(never)(
        at("notifyOrder", "/v1/orders", { ...order, confirmedAt: "not a date" }) as never,
      ),
    ).rejects.toThrow("unparsable date-time");
    await expect(
      makeCorroborateOrder(never)(
        at("corroborateOrder", "/v1/orders/corroborations", {
          orderId: "A-1",
          sessionId: "ses_00000001",
          visitorId: "vis_00000001",
          confirmedAt: "not a date",
        }) as never,
      ),
    ).rejects.toThrow("unparsable date-time");
    await expect(
      makeNotifyReturn(never)(
        at("notifyReturn", "/v1/returns", { orderId: "A-1", returnedAt: "not a date" }) as never,
      ),
    ).rejects.toThrow("unparsable date-time");
  });
});
