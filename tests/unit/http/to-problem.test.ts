// US4 (FR-030; ADR-023): one translation from any business error to Problem Details — type
// from the code, status and title from the catalogue, detail from the message, headers by code.
import { describe, expect, it } from "vitest";
import { SessionVisitorMismatch, EventTimestampOutOfRange } from "../../../src/domain/ingestion/index.js";
import {
  ExposureDecisionUnknown,
  ExposureOfNoOp,
  LedgerUnavailable,
} from "../../../src/domain/ledger/index.js";
import { OriginNotAllowed, Unauthorized } from "../../../src/domain/merchant/index.js";
import { DomainError } from "../../../src/domain/shared-kernel/index.js";
import { PROBLEM_TYPES } from "../../../src/interface-adapters/http/problem-details.js";
import { toProblem, type CataloguedError } from "../../../src/interface-adapters/http/to-problem.js";

const every: CataloguedError[] = [
  new SessionVisitorMismatch("evt_1"),
  new EventTimestampOutOfRange("evt_1", { pastMs: 0, futureMs: 0 }),
  new ExposureDecisionUnknown(),
  new ExposureOfNoOp("dec_1"),
  new LedgerUnavailable(),
  new Unauthorized(),
  new OriginNotAllowed(),
];

describe("toProblem()", () => {
  it.each(every.map((e) => [e.code, e] as const))(
    "%s → type, status and title of the catalogue, detail and instance",
    (code, error) => {
      const res = toProblem(error, "/v1/x");
      expect(res.status).toBe(PROBLEM_TYPES[code].status);
      expect(res.body).toEqual({
        type: `urn:ope:problem:${code}`,
        title: PROBLEM_TYPES[code].title,
        status: PROBLEM_TYPES[code].status,
        detail: error.message,
        instance: "/v1/x",
      });
    },
  );

  it("ledger-unavailable is a 503 with Retry-After; the others carry no headers", () => {
    expect(toProblem(new LedgerUnavailable(), "/v1/exposures")).toMatchObject({
      status: 503,
      headers: { "retry-after": "5" },
    });
    expect(toProblem(new ExposureOfNoOp("dec_1"), "/v1/exposures")).not.toHaveProperty("headers");
  });

  it("never exposes details, name or stack in the body", () => {
    class Detailed extends DomainError {
      readonly code = "session-visitor-mismatch" as const;
      readonly module = "ingestion" as const;
    }
    const { body } = toProblem(new Detailed("mixed", { eventCount: 2 }), "/v1/events");
    expect(Object.keys(body).sort()).toEqual(["detail", "instance", "status", "title", "type"]);
  });
});
