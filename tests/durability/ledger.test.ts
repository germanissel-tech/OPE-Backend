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
import { asMerchantId, asSessionId, asVisitorId } from "../../src/domain/shared-kernel/index.js";
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

function facts(id: string, merchantId = MERCHANT, sessionId = "ses_00000001") {
  return {
    decisionId: asDecisionId(id),
    merchantId,
    sessionId: asSessionId(sessionId),
    visitorId: asVisitorId("vis_00000001"),
    decidedAt: new Date(NOW),
    configuration: { platform: "platform-2", defaults: "defaults-1" },
  };
}

const intervened = (id: string, merchantId = MERCHANT, sessionId?: string): Decision =>
  InterveneDecision.of(facts(id, merchantId, sessionId), "barrier-fit", {
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
