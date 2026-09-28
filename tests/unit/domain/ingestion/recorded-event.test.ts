// Feature 031 (FR-001..FR-006) and ADR-024: what a row of the register is.
//
// **These tests are short on purpose, and that is the finding.** The row started as a class with
// three runtime rules; it is now a discriminated union, so the rules that mattered are compile
// errors and there is nothing left to assert about them — the `@ts-expect-error` cases below are the
// assertions, and they fail the build rather than a test run if the shape ever loosens.
import { describe, expect, it } from "vitest";
import {
  asBatchId,
  asEventId,
  type DecidedArrival,
  type Event,
  type ProductViewed,
  type RecordedEvent,
  type RejectedArrival,
} from "../../../../src/domain/ingestion/index.js";
import { asDecisionId } from "../../../../src/domain/ledger/index.js";
import { asMerchantId, asSessionId, asVisitorId } from "../../../../src/domain/shared-kernel/index.js";

const now = new Date("2026-09-28T12:00:00.000Z");

const event = (over: Partial<ProductViewed> = {}): Event => ({
  type: "product_viewed",
  eventId: asEventId("evt_00000001"),
  sessionId: asSessionId("ses_00000001"),
  visitorId: asVisitorId("vis_00000001"),
  occurredAt: now,
  page: { pageType: "product", productId: "SKU-1" },
  device: "mobile",
  ...over,
});

const arrival = {
  merchantId: asMerchantId("m-one"),
  batchId: asBatchId("bat_00000001"),
  position: 0,
  event: event(),
  receivedAt: now,
};

describe("a recorded arrival", () => {
  it("keeps the client's instant and OPE's, which are two different facts", () => {
    const decided: DecidedArrival = {
      ...arrival,
      disposition: "accepted",
      decisionId: asDecisionId("dec_00000001"),
      arm: "TREATMENT",
    };
    // `receivedAt` is OPE's and `occurredAt` is the client's: the register is the first place both
    // are kept (FR-002), and their difference is what a late upload looks like.
    expect(decided.receivedAt).toEqual(now);
    expect(decided.event.occurredAt).toEqual(now);
  });

  it("records a duplicate as a repetition that still took part in a decision", () => {
    // A duplicate does reach the decision plane — it is given the whole batch — so it names the
    // decision it took part in. What it does not have is the status of a first arrival.
    const repeated: DecidedArrival = {
      ...arrival,
      disposition: "duplicate",
      decisionId: asDecisionId("dec_00000001"),
    };
    expect(repeated.disposition).toBe("duplicate");
    expect(repeated.arm).toBeUndefined();
  });

  it("records a rejected batch with the invariant that refused it", () => {
    const refused: RejectedArrival = {
      ...arrival,
      disposition: "rejected",
      rejectedBy: "session-visitor-mismatch",
    };
    expect(refused.rejectedBy).toBe("session-visitor-mismatch");
  });

  it("narrows on the disposition, which is what the union is for", () => {
    const rows: RecordedEvent[] = [
      { ...arrival, disposition: "accepted", decisionId: asDecisionId("dec_00000001") },
      { ...arrival, position: 1, disposition: "rejected", rejectedBy: "event-timestamp-out-of-range" },
    ];
    // Whoever reads the register asks the discriminator; there is no helper, because a loose
    // function is not what the domain ring exports.
    const decisions = rows.map((row) => (row.disposition === "rejected" ? undefined : row.decisionId));
    expect(decisions).toEqual([asDecisionId("dec_00000001"), undefined]);
  });

  describe("what the compiler refuses, which used to be three runtime rules", () => {
    it("a rejected arrival cannot name a decision", () => {
      const impossible: RejectedArrival = {
        ...arrival,
        disposition: "rejected",
        rejectedBy: "session-visitor-mismatch",
        // A row saying "rejected" **and** naming a decision is a false statement about why the
        // traffic was not intervened, which is the question the register exists to answer.
        // @ts-expect-error a rejected arrival produced no decision, and never will
        decisionId: asDecisionId("dec_00000001"),
      };
      expect(impossible.disposition).toBe("rejected");
    });

    it("a decided arrival cannot name an invariant", () => {
      const impossible: DecidedArrival = {
        ...arrival,
        disposition: "accepted",
        decisionId: asDecisionId("dec_00000001"),
        // @ts-expect-error only a rejected arrival says which invariant refused it
        rejectedBy: "session-visitor-mismatch",
      };
      expect(impossible.disposition).toBe("accepted");
    });

    it("a decided arrival cannot leave its decision out", () => {
      // @ts-expect-error the plane always answers a decision, degraded to NO_OP if it must
      const impossible: DecidedArrival = { ...arrival, disposition: "accepted" };
      expect(impossible.disposition).toBe("accepted");
    });

    it("an arm cannot be declared without a decision, because the decision is what knows it", () => {
      const impossible: RejectedArrival = {
        ...arrival,
        disposition: "rejected",
        rejectedBy: "session-visitor-mismatch",
        // @ts-expect-error `arm` only exists on the branch that has a decision
        arm: "CONTROL",
      };
      expect(impossible.disposition).toBe("rejected");
    });
  });
});
