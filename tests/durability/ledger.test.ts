// Decisions and exposures across a restart. What `fast` already proves is that the ledger behaves;
// what only shows up here is that it still knows anything at all after the process that wrote it
// is gone.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  InterveneDecision,
  NoOpDecision,
  asDecisionId,
  type Decision,
  type Exposure,
} from "../../src/domain/ledger/index.js";
import { asMerchantId, asSessionId, asVisitorId, hours } from "../../src/domain/shared-kernel/index.js";
import { sqliteDecisionLedger, sqliteExposureLedger } from "../../src/interface-adapters/ledger/index.js";
import { restartableStore, type Restartable } from "./store-fixture.js";

const NOW = "2026-09-26T10:00:00.000Z";
const MERCHANT = asMerchantId("m-uno");
const OTHER = asMerchantId("m-dos");

let fixture: Restartable;

beforeEach(() => {
  fixture = restartableStore();
});

afterEach(() => {
  fixture.dispose();
});

const decisions = (): ReturnType<typeof sqliteDecisionLedger> =>
  sqliteDecisionLedger({ store: fixture.store, logger: fixture.logger });
const exposures = (): ReturnType<typeof sqliteExposureLedger> =>
  sqliteExposureLedger({ store: fixture.store, logger: fixture.logger });

function facts(id: string, merchantId = MERCHANT, sessionId = "ses_00000001", visitorId = "vis_00000001") {
  return {
    decisionId: asDecisionId(id),
    merchantId,
    sessionId: asSessionId(sessionId),
    visitorId: asVisitorId(visitorId),
    decidedAt: new Date(NOW),
    configuration: { platform: "platform-2", defaults: "defaults-1" },
  };
}

const intervened = (id: string, merchantId = MERCHANT, sessionId?: string, visitorId?: string): Decision =>
  InterveneDecision.of(facts(id, merchantId, sessionId, visitorId), "barrier-fit", {
    text: "If it does not fit, the exchange is free.",
    messageVersionId: "msg-1",
    anchor: "variant_selector",
  });

const exposureOf = (id: string, merchantId = MERCHANT): Exposure => ({
  merchantId,
  decisionId: asDecisionId(id),
  sessionId: asSessionId("ses_00000001"),
  visitorId: asVisitorId("vis_00000001"),
  exposedAt: new Date(NOW),
  anchor: "variant_selector",
});

describe("the decision ledger across a restart", () => {
  it("reads back the same reasoning, verdict and instant", async () => {
    const decision = intervened("dec_00000001");
    expect(await decisions().record(decision)).toEqual({ ok: true, value: undefined });

    fixture.restart();

    const found = await decisions().find(MERCHANT, asDecisionId("dec_00000001"));
    expect(found).toBeDefined();
    expect(found?.record()).toEqual(decision.record());
    // The instant has to come back an instant, not the string JSON turns it into: everything that
    // compares or windows a decision does arithmetic on it.
    expect(found?.decidedAt).toBeInstanceOf(Date);
    expect(found?.decidedAt.toISOString()).toBe(NOW);
  });

  it("keeps a NO_OP a NO_OP, with its reason", async () => {
    await decisions().record(NoOpDecision.of(facts("dec_00000002"), "control-arm"));

    fixture.restart();

    const found = await decisions().find(MERCHANT, asDecisionId("dec_00000002"));
    expect(found?.outcome).toBe("NO_OP");
    expect(found?.reason).toBe("control-arm");
    expect(found?.isIntervention()).toBe(false);
  });

  it("answers bySession in the order the decisions were recorded", async () => {
    const ledger = decisions();
    await ledger.record(intervened("dec_00000003", MERCHANT, "ses_00000009"));
    await ledger.record(intervened("dec_00000004", MERCHANT, "ses_00000009"));
    await ledger.record(intervened("dec_00000005", MERCHANT, "ses_00000008"));

    fixture.restart();

    const session = await decisions().bySession(MERCHANT, asSessionId("ses_00000009"));
    expect(session.map((d) => d.decisionId)).toEqual(["dec_00000003", "dec_00000004"]);
  });

  it("shows a merchant nothing of another one, after the restart too", async () => {
    await decisions().record(intervened("dec_00000006", MERCHANT));

    fixture.restart();

    const ledger = decisions();
    expect(await ledger.find(OTHER, asDecisionId("dec_00000006"))).toBeUndefined();
    expect(await ledger.bySession(OTHER, asSessionId("ses_00000001"))).toEqual([]);
    expect(await ledger.find(MERCHANT, asDecisionId("dec_00000006"))).toBeDefined();
  });

  it("answers byVisitor across the restart, and tells one merchant's visitor from another's", async () => {
    // This is the read the fatigue limit needs and the reason feature 032 exists: without it the
    // count of what a visitor already received lived only in memory, so a restart handed them their
    // whole quota back.
    const ledger = decisions();
    await ledger.record(intervened("dec_00000010", MERCHANT, "ses_00000010", "vis_00000002"));
    await ledger.record(intervened("dec_00000011", MERCHANT, "ses_00000011", "vis_00000002"));
    await ledger.record(intervened("dec_00000012", MERCHANT, "ses_00000012", "vis_00000003"));
    // The same visitor identifier under another merchant, which must not be found (constitution V).
    await ledger.record(intervened("dec_00000013", OTHER, "ses_00000013", "vis_00000002"));
    // A NO_OP of the same visitor: the port answers every outcome, because which ones count is
    // `decision.isIntervention()`, a rule of the domain and not of the store.
    await ledger.record(
      NoOpDecision.of(facts("dec_00000014", MERCHANT, "ses_00000014", "vis_00000002"), "control-arm"),
    );

    fixture.restart();

    const since = new Date(Date.parse(NOW) - hours(24));
    const mine = await decisions().byVisitor(MERCHANT, asVisitorId("vis_00000002"), since);
    // Two sessions of this visitor plus the NO_OP, oldest first; not the other visitor's, not the
    // other merchant's.
    expect(mine.map((d) => d.decisionId)).toEqual(["dec_00000010", "dec_00000011", "dec_00000014"]);
    expect(mine.filter((d) => d.isIntervention()).map((d) => d.decisionId)).toEqual([
      "dec_00000010",
      "dec_00000011",
    ]);
    expect(await decisions().byVisitor(OTHER, asVisitorId("vis_00000003"), since)).toEqual([]);
  });

  it("leaves outside the window what the window excludes", async () => {
    await decisions().record(intervened("dec_00000015", MERCHANT, "ses_00000015", "vis_00000004"));
    await decisions().record(intervened("dec_00000016", MERCHANT, "ses_00000016", "vis_00000004"));
    // The row's own timestamp is what the index ranges over, so this is the thing to age. Reaching
    // for the column directly is the only way: nothing in the domain can write a past `created_at`,
    // which is exactly the property that makes the bound sound.
    fixture.store.run(
      "UPDATE decisions SET created_at = '2020-01-01T00:00:00.000Z' WHERE decision_id = 'dec_00000015'",
      {},
    );

    fixture.restart();

    const recent = await decisions().byVisitor(
      MERCHANT,
      asVisitorId("vis_00000004"),
      new Date("2026-01-01T00:00:00.000Z"),
    );
    expect(recent.map((d) => d.decisionId)).toEqual(["dec_00000016"]);
    // And with a wide enough window the aged one is there again: it was excluded, not lost.
    const all = await decisions().byVisitor(
      MERCHANT,
      asVisitorId("vis_00000004"),
      new Date("2019-01-01T00:00:00.000Z"),
    );
    expect(all.map((d) => d.decisionId)).toEqual(["dec_00000015", "dec_00000016"]);
  });

  it("walks the visitor index instead of scanning the table", async () => {
    // An index the planner does not use is an index that does not exist, and in this family of
    // features a wrong index has already cost more than a missing one. The plan is asserted rather
    // than the timing: a timing assertion on a table with three rows says nothing.
    await decisions().record(intervened("dec_00000017", MERCHANT, "ses_00000017", "vis_00000005"));
    const plan = fixture.store
      .all(
        `EXPLAIN QUERY PLAN SELECT document FROM decisions
         WHERE merchant_id = :merchant AND visitor_id = :visitor AND created_at >= :since
         ORDER BY created_at`,
        { merchant: MERCHANT, visitor: "vis_00000005", since: NOW },
      )
      .map((row) => String(row["detail"]))
      .join(" | ");
    expect(plan).toContain("decisions_by_visitor");
    expect(plan).not.toContain("SCAN decisions");
    // And no sort step: ordering by the third column of the index is why the order is free.
    expect(plan).not.toMatch(/USE TEMP B-TREE FOR ORDER BY/i);
  });

  it("refuses to overwrite a decision already recorded, and keeps the first", async () => {
    // The ledger is immutable: a repeated identifier is a broken generator, not an update. The
    // answer is the failure channel the port already has, so the plane fails closed instead of
    // losing the evidence of the first decision.
    const first = intervened("dec_00000008", MERCHANT, "ses_00000001");
    expect(await decisions().record(first)).toEqual({ ok: true, value: undefined });

    fixture.restart();

    const again = NoOpDecision.of(facts("dec_00000008", MERCHANT, "ses_00000002"), "control-arm");
    const refused = await decisions().record(again);
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.error.code).toBe("ledger-unavailable");

    fixture.restart();

    const held = await decisions().find(MERCHANT, asDecisionId("dec_00000008"));
    expect(held?.outcome).toBe("INTERVENE");
    expect(held?.sessionId).toBe("ses_00000001");
  });

  it("degrades to the ledger's failure channel when the store refuses, and says why in the log", async () => {
    fixture.makeUnavailable();

    const result = await decisions().record(intervened("dec_00000007"));

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("ledger-unavailable");
    expect(fixture.logged).toHaveLength(1);
    expect(fixture.logged[0]?.fields["write"]).toBe("decision");
    // The cause is the only place a full disk and a lost permission look different from outside.
    expect(fixture.logged[0]?.fields["cause"]).toEqual(expect.any(String));
  });
});

describe("the exposure ledger across a restart", () => {
  it("answers a repeated confirmation the same before and after", async () => {
    expect(await exposures().record(exposureOf("dec_00000001"))).toEqual({ ok: true, value: "recorded" });
    expect(await exposures().record(exposureOf("dec_00000001"))).toEqual({
      ok: true,
      value: "already-recorded",
    });

    fixture.restart();

    // This is the line the feature exists for: before it, the restart emptied the map and a
    // second confirmation looked like a first one.
    expect(await exposures().record(exposureOf("dec_00000001"))).toEqual({
      ok: true,
      value: "already-recorded",
    });
  });

  it("reads the exposure back with its anchor and its instant", async () => {
    await exposures().record(exposureOf("dec_00000002"));

    fixture.restart();

    const found = await exposures().find(MERCHANT, asDecisionId("dec_00000002"));
    expect(found).toEqual(exposureOf("dec_00000002"));
    expect(found?.exposedAt).toBeInstanceOf(Date);
  });

  it("says nothing when there is no exposure for that decision", async () => {
    // The empty answer has its own case because it is a different path through the gateway: with
    // no row there is no document to read, and reading one anyway is what a store returns
    // `undefined` for.
    expect(await exposures().find(MERCHANT, asDecisionId("dec_00000009"))).toBeUndefined();

    fixture.restart();

    expect(await exposures().find(MERCHANT, asDecisionId("dec_00000009"))).toBeUndefined();
  });

  it("does not let one merchant's exposure block another's", async () => {
    await exposures().record(exposureOf("dec_00000003", MERCHANT));

    fixture.restart();

    expect(await exposures().record(exposureOf("dec_00000003", OTHER))).toEqual({
      ok: true,
      value: "recorded",
    });
    expect(await exposures().find(OTHER, asDecisionId("dec_00000003"))).toBeDefined();
  });
});
