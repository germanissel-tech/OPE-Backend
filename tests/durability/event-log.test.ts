// The durable register: the **same** contract the in-memory one runs, plus the half that only exists
// here — what survives a restart. Running one file against both is what keeps the behaviour from
// depending on the deployment (feature 030's lesson).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { asBatchId, asEventId } from "../../src/domain/ingestion/index.js";
import { asDecisionId } from "../../src/domain/ledger/index.js";
import { asMerchantId, asSessionId } from "../../src/domain/shared-kernel/index.js";
import { sqliteEventLog } from "../../src/interface-adapters/ingestion/index.js";
import { anEventLog, decided, rejected } from "../unit/interface-adapters/ingestion/event-log.contract.js";
import { restartableStore, type Restartable } from "./store-fixture.js";

const ONE = asMerchantId("m-one");

describe("sqliteEventLog", () => {
  let fixture: Restartable;

  beforeEach(() => {
    fixture = restartableStore();
  });

  afterEach(() => {
    fixture.dispose();
  });

  // The store is synchronous, so nothing is deferred here either: what defers is the queue, and the
  // queue has its own tests. This gateway writes when it is asked to.
  anEventLog(() => ({
    log: sqliteEventLog({ store: fixture.store, logger: fixture.logger }),
    settle: () => Promise.resolve(),
  }));

  it("finds what it recorded after the process that wrote it is gone", async () => {
    // The one thing this suite exists for (FR-009). Everything above would pass in memory.
    sqliteEventLog({ store: fixture.store, logger: fixture.logger }).record([decided()]);
    fixture.restart();

    const rows = await sqliteEventLog({
      store: fixture.store,
      logger: fixture.logger,
    }).byDecision(ONE, asDecisionId("dec_00000001"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.event.eventId).toBe(asEventId("evt_00000001"));
    // And the instants came back as instants across the restart, which is where a lost `$date` mark
    // would show up first.
    expect(rows[0]?.receivedAt).toBeInstanceOf(Date);
  });

  it("keeps the arrival order across a restart, which is the order of `id` and not of insertion luck", async () => {
    const log = () => sqliteEventLog({ store: fixture.store, logger: fixture.logger });
    log().record([decided({ batchId: asBatchId("bat_a"), event: { ...decided().event } })]);
    log().record([
      decided({ batchId: asBatchId("bat_b"), event: { ...decided().event, eventId: asEventId("evt_2") } }),
    ]);
    fixture.restart();

    const rows = await log().bySession(ONE, asSessionId("ses_00000001"));
    expect(rows.map((r) => r.batchId)).toEqual([asBatchId("bat_a"), asBatchId("bat_b")]);
  });

  it("says so in the log when the store will not take a write, and does not throw at the caller", () => {
    // The difference from every other durable gateway (ADR-021): there is no failure channel, because
    // a measurement that could not be written must not degrade a decision. So the log line is the
    // whole story — and the caller, which must not wait, is not made to handle anything.
    const log = sqliteEventLog({ store: fixture.store, logger: fixture.logger });
    fixture.makeUnavailable();

    expect(() => {
      log.record([decided(), decided({ position: 1 })]);
    }).not.toThrow();
    const refusal = fixture.logged.find(
      (entry) =>
        entry.message === "The durable store refused a write of the event register; those arrivals are lost.",
    );
    expect(refusal).toBeDefined();
    // **How many** were lost is the point of the line, not that a line exists: without it the log says
    // something went wrong and nothing about the size of the hole.
    expect(refusal?.fields["arrivals"]).toBe(2);
    expect(refusal?.fields["cause"]).toBeDefined();
  });

  describe("uses the index it was given, which is not the same as having one", () => {
    // **In this feature a wrong index was more than three times worse than none**: the volume query
    // measured 507 ms with no useful index, 1 703 ms with `(merchant_id, type)` and 107 ms with the
    // covering one (research R-06). So the plan is verified rather than assumed — and it is verified
    // against a table with rows, because SQLite plans differently for an empty one.
    const planOf = (sql: string, params: Record<string, string>): string =>
      fixture.store
        .all(`EXPLAIN QUERY PLAN ${sql}`, params)
        .map((row) => String(row["detail"]))
        .join(" | ");

    beforeEach(() => {
      const log = sqliteEventLog({ store: fixture.store, logger: fixture.logger });
      for (let n = 0; n < 200; n += 1) {
        log.record([decided({ batchId: asBatchId(`bat_${String(n)}`) })]);
      }
    });

    it.each([
      ["by decision", "received_events_by_decision", "decision_id = :p", { p: "dec_00000001" }],
      ["by session", "received_events_by_session", "session_id = :p", { p: "ses_00000001" }],
      ["by event", "received_events_by_event", "event_id = :p", { p: "evt_00000001" }],
    ])("searches %s through %s", (_name, index, predicate, params) => {
      const plan = planOf(
        `SELECT document FROM received_events WHERE merchant_id = 'm-one' AND ${predicate} ORDER BY id`,
        params,
      );
      expect(plan).toContain(index);
      // A scan of the table is the failure this test exists to catch, and it is what a plan says when
      // the index does not apply — the query would still answer, just not in the time that was measured.
      expect(plan).not.toContain("SCAN received_events");
    });

    it("counts the volume through the covering index, over a range of received_at", () => {
      const plan = planOf(
        `SELECT type, COUNT(*) AS count FROM received_events
         WHERE merchant_id = 'm-one' AND received_at >= :from AND received_at <= :to GROUP BY type`,
        { from: "2026-01-01T00:00:00.000Z", to: "2027-01-01T00:00:00.000Z" },
      );
      expect(plan).toContain("received_events_volume");
      expect(plan).not.toContain("SCAN received_events");
    });
  });

  it("writes a rejected batch with no decision, which the column admits for exactly that", async () => {
    sqliteEventLog({ store: fixture.store, logger: fixture.logger }).record([rejected()]);
    fixture.restart();

    // Built **after** the restart on purpose: a gateway holds the store it was given, and the one
    // from before points at a connection that is closed.
    const reopened = sqliteEventLog({ store: fixture.store, logger: fixture.logger });
    const rows = await reopened.byEvent(ONE, asEventId("evt_00000001"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.disposition).toBe("rejected");
    // Nothing links it to a decision, and `byDecision` therefore cannot reach it: that **is** the
    // statement "this traffic produced no decision" (FR-006).
    expect(await reopened.byDecision(ONE, asDecisionId("dec_00000001"))).toEqual([]);
  });
});
