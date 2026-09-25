// Feature 007, US4 (FR-030..FR-032; ADR-021): when a ledger cannot accept a record the system fails closed —
// the ingestion degrades to NO_OP `ledger-unavailable`, the exposure answers 503 with Retry-After —
// and recovers as soon as the ledger is back.
import { afterEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { AssignmentLedgerPort } from "../../src/composition/modules/experiment.js";
import { DecisionLedgerPort, ExposureLedgerPort } from "../../src/composition/modules/ledger.js";
import { ClockPort, LoggerPort } from "../../src/composition/modules/shared-kernel.js";
import { InterveneDecision, type Decision, asDecisionId } from "../../src/domain/ledger/index.js";
import { asMerchantId, asSessionId, asVisitorId } from "../../src/domain/shared-kernel/index.js";
import { memoryDecisionLedger } from "../../src/interface-adapters/ledger/gateways/memory-decision-ledger.js";
import { memoryExposureLedger } from "../../src/interface-adapters/ledger/gateways/memory-exposure-ledger.js";
import { json, problemOf } from "../helpers/json.js";
import { batchOf, fixedClock, postEvents, postExposure, startTestApp } from "../helpers/test-app.js";
import {
  flakyLedger,
  recordingLogger,
  unavailableAssignmentLedger,
  unavailableDecisionLedger,
  unavailableExposureLedger,
} from "../helpers/unavailable-ledgers.js";
import type { components } from "#generated/api.js";
import type { App } from "../../src/composition/bootstrap.js";

type IngestResult = components["schemas"]["IngestResult"];

const NOW = "2026-09-17T12:00:00.000Z";
const KEY = "key-a-1";

let app: App | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

const intervene = (): Decision =>
  InterveneDecision.of(
    {
      decisionId: asDecisionId("dec_intervene1"),
      merchantId: asMerchantId("m_a"),
      configuration: { platform: "platform-1", defaults: "defaults-1" },
      sessionId: asSessionId("ses_00000001"),
      visitorId: asVisitorId("vis_00000001"),
      decidedAt: new Date(NOW),
    },
    "barrier-size",
    {
      text: "If it does not fit, the exchange is free.",
      messageVersionId: "msg-1",
      anchor: "variant_selector",
    },
  );

const exposure = {
  decisionId: "dec_intervene1",
  sessionId: "ses_00000001",
  visitorId: "vis_00000001",
  exposedAt: NOW,
  anchor: "variant_selector",
};

describe("ledger unavailable", () => {
  it("ingestion with the decision ledger down → 202 NO_OP ledger-unavailable, nothing recorded, no 5xx, reported in the log", async () => {
    const { logger, entries } = recordingLogger();
    app = await startTestApp({
      ports: [
        replace(ClockPort, fixedClock(NOW)),
        replace(DecisionLedgerPort, unavailableDecisionLedger()),
        replace(LoggerPort, logger),
      ],
    });
    const res = await postEvents(app.app, batchOf(2, 1, { occurredAt: NOW }), { key: KEY });
    expect(res.statusCode).toBe(202);
    const body = json(res) as IngestResult;
    expect(body.decision).toMatchObject({ outcome: "NO_OP", reason: "ledger-unavailable" });
    expect(
      await app.resolve(DecisionLedgerPort).find(asMerchantId("m_a"), asDecisionId(body.decision.decisionId)),
    ).toBeUndefined();
    const reported = entries.find((e) => e.message.includes("ledger-unavailable"));
    expect(reported?.level).toBe("error");
    expect(reported?.fields).toMatchObject({ merchantId: "m_a" });
    expect(JSON.stringify(reported)).not.toContain("vis_00000001");
  });

  it("ingestion with the assignment ledger down → 202 NO_OP ledger-unavailable, no assignment and no decision recorded", async () => {
    const { logger, entries } = recordingLogger();
    app = await startTestApp({
      ports: [
        replace(ClockPort, fixedClock(NOW)),
        replace(AssignmentLedgerPort, unavailableAssignmentLedger()),
        replace(LoggerPort, logger),
      ],
    });
    const res = await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), { key: KEY });
    expect(res.statusCode).toBe(202);
    const body = json(res) as IngestResult;
    expect(body.decision).toMatchObject({ outcome: "NO_OP", reason: "ledger-unavailable" });
    expect(
      await app.resolve(DecisionLedgerPort).find(asMerchantId("m_a"), asDecisionId(body.decision.decisionId)),
    ).toBeUndefined();
    const reported = entries.find((e) => e.message.includes("assignment not recorded"));
    expect(reported?.level).toBe("error");
    expect(reported?.fields).toMatchObject({ merchantId: "m_a", decisionId: body.decision.decisionId });
  });

  it("exposure with the exposure ledger down → 503 Problem Details ledger-unavailable with Retry-After, nothing recorded", async () => {
    app = await startTestApp({
      ports: [replace(ClockPort, fixedClock(NOW)), replace(ExposureLedgerPort, unavailableExposureLedger())],
    });
    await app.resolve(DecisionLedgerPort).record(intervene());
    const res = await postExposure(app.app, exposure, { key: KEY });
    expect(res.statusCode).toBe(503);
    expect(res.headers["content-type"]).toMatch("application/problem+json");
    expect(problemOf(res)).toMatchObject({
      type: "urn:ope:problem:ledger-unavailable",
      status: 503,
      instance: "/v1/exposures",
    });
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    expect(
      await app.resolve(ExposureLedgerPort).find(asMerchantId("m_a"), asDecisionId("dec_intervene1")),
    ).toBeUndefined();
  });

  it("once the ledgers are back, the same batch records a decision and the same exposure is 201", async () => {
    let down = true;
    app = await startTestApp({
      ports: [
        replace(ClockPort, fixedClock(NOW)),
        replace(
          DecisionLedgerPort,
          flakyLedger(memoryDecisionLedger(), () => down),
        ),
        replace(
          ExposureLedgerPort,
          flakyLedger(memoryExposureLedger(), () => down),
        ),
      ],
    });
    const first = json(
      await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), { key: KEY }),
    ) as IngestResult;
    expect(first.decision.reason).toBe("ledger-unavailable");
    await app.resolve(DecisionLedgerPort).record(intervene()); // while down: not recorded either
    expect((await postExposure(app.app, exposure, { key: KEY })).statusCode).toBe(422);

    down = false;
    const second = json(
      await postEvents(app.app, batchOf(1, 2, { occurredAt: NOW }), { key: KEY }),
    ) as IngestResult;
    expect(second.decision.reason).not.toBe("ledger-unavailable");
    expect(
      await app
        .resolve(DecisionLedgerPort)
        .find(asMerchantId("m_a"), asDecisionId(second.decision.decisionId)),
    ).toBeDefined();
    await app.resolve(DecisionLedgerPort).record(intervene());
    expect((await postExposure(app.app, exposure, { key: KEY })).statusCode).toBe(201);
  });
});
