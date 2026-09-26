// The evidence chain end to end, across one restart: a decision with its reasoning, the exposure
// that confirms it, the order attributed to that session and the corroboration that sustains it.
//
// The other suites take one port at a time and answer "did this survive?". This one answers the
// question the MVP actually asks — **is the chain still whole?** — which is a different thing: the
// four records can each come back and still not join up, because what joins them is not a foreign
// key but the identifiers they carry.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InterveneDecision, asDecisionId } from "../../src/domain/ledger/index.js";
import { Corroboration, Order, asOrderId } from "../../src/domain/outcomes/index.js";
import { Money, asMerchantId, asSessionId, asVisitorId } from "../../src/domain/shared-kernel/index.js";
import { sqliteDecisionLedger, sqliteExposureLedger } from "../../src/interface-adapters/ledger/index.js";
import { sqliteCorroborationLedger, sqliteOrderLedger } from "../../src/interface-adapters/outcomes/index.js";
import { restartableStore, type Restartable } from "./store-fixture.js";

const NOW = new Date("2026-09-26T12:00:00.000Z");
const SKEW_MS = 5 * 60 * 1000;
const MERCHANT = asMerchantId("m-uno");
const SESSION = asSessionId("ses_00000001");
const VISITOR = asVisitorId("vis_00000001");
const DECISION = asDecisionId("dec_00000001");
const ORDER = asOrderId("A-1");

let fixture: Restartable;

beforeEach(() => {
  fixture = restartableStore();
});

afterEach(() => {
  fixture.dispose();
});

describe("the whole evidence chain across a restart", () => {
  it("keeps the four records and keeps them joined to each other", async () => {
    const deps = { store: fixture.store, logger: fixture.logger };

    const decision = InterveneDecision.of(
      {
        decisionId: DECISION,
        merchantId: MERCHANT,
        sessionId: SESSION,
        visitorId: VISITOR,
        decidedAt: NOW,
        configuration: { platform: "platform-1", defaults: "defaults-1" },
        inference: {
          policyVersion: "policy-1",
          // The three barriers of the MVP, and only those (constitution, contract vocabulary).
          confidences: { fit: 0.9, price: 0.1, returns: 0.2 },
          matched: ["rule-1"],
          barrier: "fit",
          trigger: "rules",
          evidence: { truth: "known" },
        },
      },
      "barrier-fit",
      {
        text: "If it does not fit, the exchange is free.",
        messageVersionId: "msg-1",
        anchor: "variant_selector",
      },
    );
    await sqliteDecisionLedger(deps).record(decision);
    await sqliteExposureLedger(deps).record({
      merchantId: MERCHANT,
      decisionId: DECISION,
      sessionId: SESSION,
      visitorId: VISITOR,
      exposedAt: NOW,
      anchor: "variant_selector",
    });
    const order = Order.of(
      {
        merchantId: MERCHANT,
        orderId: ORDER,
        total: Money.rehydrate({ amount: "100.00", currency: "ARS" }),
        items: [{ sku: "SKU-1", quantity: 1 }],
        confirmedAt: NOW,
        receivedAt: NOW,
        sessionId: SESSION,
      },
      SKEW_MS,
    );
    if (!order.ok) throw new Error(order.error.message);
    await sqliteOrderLedger(deps).record(order.value);
    const corroboration = Corroboration.of(
      {
        merchantId: MERCHANT,
        orderId: ORDER,
        sessionId: SESSION,
        visitorId: VISITOR,
        confirmedAt: NOW,
        receivedAt: NOW,
      },
      SKEW_MS,
    );
    if (!corroboration.ok) throw new Error(corroboration.error.message);
    await sqliteCorroborationLedger(deps).record(corroboration.value);

    fixture.restart();

    const after = { store: fixture.store, logger: fixture.logger };
    const foundDecision = await sqliteDecisionLedger(after).find(MERCHANT, DECISION);
    const foundExposure = await sqliteExposureLedger(after).find(MERCHANT, DECISION);
    const foundOrder = await sqliteOrderLedger(after).find(MERCHANT, ORDER);
    const foundCorroborations = await sqliteCorroborationLedger(after).find(MERCHANT, ORDER);

    // The reasoning, which is what makes a decision auditable rather than merely recorded
    // (constitution IX): the barrier it settled on and what it knew about the product.
    expect(foundDecision?.inference?.barrier).toBe("fit");
    expect(foundDecision?.inference?.evidence.truth).toBe("known");

    // And the joins, which no column enforces: the exposure points at the decision, the order and
    // the corroboration at the same session, and the corroboration at the order.
    expect(foundExposure?.decisionId).toBe(foundDecision?.decisionId);
    expect(foundOrder?.sessionId).toBe(foundDecision?.sessionId);
    expect(foundCorroborations[0]?.orderId).toBe(foundOrder?.orderId);
    expect(foundCorroborations[0]?.sessionId).toBe(foundDecision?.sessionId);

    // And the correlation the outcomes module does: the session of the order leads back to the
    // decision, which is the step that turns a sale into an attributed one (ADR-028).
    const ofSession = await sqliteDecisionLedger(after).bySession(MERCHANT, SESSION);
    expect(ofSession.map((d) => d.decisionId)).toEqual([DECISION]);
  });
});
