// Feature 032: the three durable reads of the reconstruction, turned from exceptions into values.
//
// This is the one place the translation itself is under test. The durability suite replaces the whole
// port with a double, because what it is about is what the **plane** does with a failure; here the
// question is the other half — that a store which throws produces a `StateUnavailable` and not an
// exception escaping into the application ring, which may not catch one
// (`ope/no-generic-catch-in-application`).
//
// It was a mutant with **no coverage at all** that said so: nothing in the fast suite had ever entered
// the `catch`, which meant the crux of the phase was untested while every test around it passed.
import { describe, expect, it } from "vitest";
import { NoOpDecision, asDecisionId, type Decision } from "../../../../src/domain/ledger/index.js";
import { asMerchantId, asSessionId, asVisitorId, hours } from "../../../../src/domain/shared-kernel/index.js";
import { durablePastActivity } from "../../../../src/interface-adapters/decision/gateways/durable-past-activity.js";
import type { RecordedEvent } from "../../../../src/domain/ingestion/index.js";

const M = asMerchantId("m_a");
const S = asSessionId("ses_00000001");
const V = asVisitorId("vis_00000001");
const now = new Date("2026-09-19T12:00:00.000Z");
const since = new Date(now.getTime() - hours(24));

const decided: Decision = NoOpDecision.of(
  {
    decisionId: asDecisionId("dec_00000001"),
    merchantId: M,
    sessionId: S,
    visitorId: V,
    decidedAt: now,
    configuration: { platform: "platform-2", defaults: "defaults-1" },
  },
  "control-arm",
);

/** The register and the ledger, answering or throwing, and what was logged. */
function subject(throwing: "none" | "events" | "decisions") {
  const logged: { fields: Record<string, unknown>; message: string }[] = [];
  const record = (fields: Record<string, unknown>, message: string): void => {
    logged.push({ fields, message });
  };
  const boom = (): never => {
    throw new Error("the store is closed");
  };
  const arrivals: readonly RecordedEvent[] = [];
  const past = durablePastActivity({
    events: {
      bySession: () => (throwing === "events" ? boom() : Promise.resolve(arrivals)),
    },
    decisions: {
      bySession: () => (throwing === "decisions" ? boom() : Promise.resolve([decided])),
      byVisitor: () => (throwing === "decisions" ? boom() : Promise.resolve([decided])),
    },
    logger: { info: record, warn: record, error: record },
  });
  return { past, logged };
}

describe("durablePastActivity", () => {
  it("hands back what the register and the ledger answered", async () => {
    const { past, logged } = subject("none");
    expect(await past.arrivalsOf(M, S)).toEqual({ ok: true, value: [] });
    expect(await past.decisionsOf(M, S)).toEqual({ ok: true, value: [decided] });
    expect(await past.decisionsOfVisitor(M, V, since)).toEqual({ ok: true, value: [decided] });
    // Nothing logged when nothing went wrong: the log is for the exception, not for the traffic.
    expect(logged).toEqual([]);
  });

  it("turns a register that throws into StateUnavailable, and says which read it was", async () => {
    const { past, logged } = subject("events");
    const answer = await past.arrivalsOf(M, S);
    expect(answer.ok).toBe(false);
    expect(answer.ok ? undefined : answer.error.code).toBe("state-unavailable");
    // `session`, because that is the side that failed — which is what tells FR-013 from FR-015 in a log.
    expect(answer.ok ? undefined : answer.error.details).toMatchObject({ path: "session" });
    // The cause is logged and **not carried**: the plane cannot act on it and must not put it in a
    // decision, and losing it entirely would leave an operator with a degradation and no reason.
    expect(logged).toHaveLength(1);
    expect(logged[0]?.fields).toMatchObject({ read: "arrivals", cause: "the store is closed" });
  });

  it("turns a ledger that throws into StateUnavailable, naming each of its two reads apart", async () => {
    const { past, logged } = subject("decisions");
    const ofSession = await past.decisionsOf(M, S);
    const ofVisitor = await past.decisionsOfVisitor(M, V, since);
    expect([ofSession.ok, ofVisitor.ok]).toEqual([false, false]);
    // The two sides of the same store, told apart: one is the budget of a session, the other the
    // fatigue of a visitor, and an operator reading the log needs to know which.
    expect(ofVisitor.ok ? undefined : ofVisitor.error.details).toMatchObject({ path: "visitor" });
    expect(logged.map((entry) => entry.fields["read"])).toEqual(["decisions", "visitor-decisions"]);
  });

  it("reports something that is not an Error as what it is, instead of losing it", async () => {
    // A store driver is a border: it can reject with anything. Reading `.message` off a string would
    // log `undefined` and throw away the only clue there was.
    const logged: { fields: Record<string, unknown>; message: string }[] = [];
    const past = durablePastActivity({
      events: {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- a rejection that is not an Error is the subject of this test
        bySession: () => Promise.reject("SQLITE_BUSY"),
      },
      decisions: { bySession: () => Promise.resolve([]), byVisitor: () => Promise.resolve([]) },
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: (fields, message) => logged.push({ fields, message }),
      },
    });

    expect((await past.arrivalsOf(M, S)).ok).toBe(false);
    expect(logged[0]?.fields).toMatchObject({ cause: "SQLITE_BUSY" });
  });
});
