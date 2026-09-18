// ADR-024: an unparsable date-time is a programming error caught at the DTO → domain edge (the
// contract validated the format; the domain never sees NaN). Exercised directly on the
// controllers because no request passes the contract with such a value.
import { describe, expect, it } from "vitest";
import { makeIngestEvents } from "../../../src/interface-adapters/http/controllers/ingestion/ingest-events.js";
import { makeConfirmExposureHandler } from "../../../src/interface-adapters/http/controllers/ledger/confirm-exposure.js";
import { INGEST_KEY_SCHEME } from "../../../src/interface-adapters/http/security/ingest-key.js";
import { eventOf } from "../../helpers/test-app.js";

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
        anchor: "size_selector",
      } as never,
      security,
    };
    await expect(handler(req)).rejects.toThrow("unparsable date-time");
  });
});
