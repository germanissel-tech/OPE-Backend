// Feature 046 (D-30): the decisions of a visitor are taken one at a time, in the order they arrived; the decisions
// of other visitors —of the same merchant or of another one— do not wait; a decision that fails releases the turn;
// and nothing is held once a visitor has nothing in course. Over a scripted plane that waits for the test.
import { describe, expect, it } from "vitest";
import { VisitorTurns } from "../../../../src/application/decision/index.js";
import { asMerchantId, asVisitorId } from "../../../../src/domain/shared-kernel/index.js";
import type { DecisionPlane, DecisionRequest } from "../../../../src/application/ingestion/index.js";
import type { EventBatch } from "../../../../src/domain/ingestion/index.js";
import type { Decision } from "../../../../src/domain/ledger/index.js";

const NOW = new Date("2026-10-13T12:00:00.000Z");

/** A request of a visitor of a merchant: the turn reads nothing else of the batch. */
const requestOf = (merchant: string, visitor: string): DecisionRequest => ({
  merchantId: asMerchantId(merchant),
  // Only the visitor is read; a whole batch would be noise for what this test asserts.
  batch: { visitorId: asVisitorId(visitor) } as unknown as EventBatch,
  now: NOW,
});

/** A plane whose decisions wait until the test releases them, and that says when each one started. */
function scripted() {
  const started: string[] = [];
  const releases = new Map<string, (outcome: "ok" | "throw") => void>();
  const plane: DecisionPlane = {
    decide: (request) => {
      const name = `${request.merchantId}/${request.batch.visitorId}#${started.length + 1}`;
      started.push(name);
      return new Promise<Decision>((resolve, reject) => {
        releases.set(name, (outcome) => {
          if (outcome === "throw") reject(new Error(`${name} failed`));
          else resolve({ decisionId: name } as unknown as Decision);
        });
      });
    },
  };
  const release = (name: string, outcome: "ok" | "throw" = "ok") => releases.get(name)?.(outcome);
  return { plane, started, release };
}

/** Lets every pending continuation run, so what could start has started. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe("VisitorTurns", () => {
  it("a second decision of the same visitor does not start until the first ends, and they go in the order they came", async () => {
    const { plane, started, release } = scripted();
    const turns = new VisitorTurns(plane);
    const first = turns.decide(requestOf("m_a", "v1"));
    const second = turns.decide(requestOf("m_a", "v1"));
    const third = turns.decide(requestOf("m_a", "v1"));
    await settle();
    expect(started).toEqual(["m_a/v1#1"]);
    release("m_a/v1#1");
    expect(await first).toEqual({ decisionId: "m_a/v1#1" });
    await settle();
    expect(started).toEqual(["m_a/v1#1", "m_a/v1#2"]);
    release("m_a/v1#2");
    await settle();
    release("m_a/v1#3");
    expect([await second, await third]).toEqual([{ decisionId: "m_a/v1#2" }, { decisionId: "m_a/v1#3" }]);
  });

  it("another visitor, or the same visitor id in another merchant, does not wait", async () => {
    const { plane, started, release } = scripted();
    const turns = new VisitorTurns(plane);
    void turns.decide(requestOf("m_a", "v1"));
    void turns.decide(requestOf("m_a", "v2"));
    void turns.decide(requestOf("m_b", "v1"));
    await settle();
    expect(started).toEqual(["m_a/v1#1", "m_a/v2#2", "m_b/v1#3"]);
    for (const name of started) release(name);
  });

  it("a decision that fails releases the turn: the next one of that visitor is taken, and the failure reaches its caller", async () => {
    const { plane, started, release } = scripted();
    const turns = new VisitorTurns(plane);
    const failing = turns.decide(requestOf("m_a", "v1"));
    const next = turns.decide(requestOf("m_a", "v1"));
    await settle();
    release("m_a/v1#1", "throw");
    await expect(failing).rejects.toThrow("m_a/v1#1 failed");
    await settle();
    expect(started).toEqual(["m_a/v1#1", "m_a/v1#2"]);
    release("m_a/v1#2");
    expect(await next).toEqual({ decisionId: "m_a/v1#2" });
  });

  it("nothing is held once no visitor has a decision in course", async () => {
    const { plane, started, release } = scripted();
    const turns = new VisitorTurns(plane);
    const decisions = [
      turns.decide(requestOf("m_a", "v1")),
      turns.decide(requestOf("m_a", "v1")),
      turns.decide(requestOf("m_a", "v2")),
    ];
    await settle();
    expect(turns.visitorsInCourse()).toBe(2);
    release("m_a/v1#1");
    release("m_a/v2#2");
    await settle();
    expect(turns.visitorsInCourse()).toBe(1);
    release(started[2] ?? "");
    await Promise.all(decisions);
    expect(turns.visitorsInCourse()).toBe(0);
  });
});
