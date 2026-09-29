// What happens when the durable side cannot be read (feature 032, the answer of Q1). Not a story of
// its own: it is what makes the other three trustworthy, and it is two rules that look alike and are
// not:
//
//   - **the interventions are mandatory.** They are what the caps are counted from, nothing can stand
//     in for them, and a failure degrades the decision to `NO_OP state-unavailable` (FR-013).
//   - **the signals are best-effort.** Without them the session absorbs the ones of the current batch,
//     which is what the system does in every session today, so the decision is taken and **records that
//     the signals were short** (FR-015).
//
// The argument for the asymmetry is the only one that matters: without the caps the system does
// something it has never done; without the signals it does what it is doing in production right now.
//
// **The failure is injected at the port of the reconstruction and not by breaking the store**, and that
// is deliberate rather than convenient: with the whole store down the assignment fails first and the
// decision degrades to `ledger-unavailable`, which is a different rule, from ADR-021, already covered by
// its own suites. What these tests are about is the three reads of the rebuild not answering, which is
// exactly the condition FR-013 and FR-015 describe.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { durableDeployment } from "../../src/composition/deployments/durable.js";
import { replace } from "../../src/composition/graph/index.js";
import { PastActivityPort } from "../../src/composition/modules/decision.js";
import { DecisionLedgerPort } from "../../src/composition/modules/ledger.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { StateUnavailable } from "../../src/domain/decision/index.js";
import { asDecisionId } from "../../src/domain/ledger/index.js";
import { asMerchantId, fail, ok } from "../../src/domain/shared-kernel/index.js";
import { json } from "../helpers/json.js";
import {
  NOW,
  catalogProductOf,
  eventOf,
  fixedClock,
  postEvents,
  putCatalog,
  startTestApp,
  type MerchantSpec,
} from "../helpers/test-app.js";
import type { components } from "#generated/api.js";
import type { PastActivity } from "../../src/application/decision/index.js";
import type { App } from "../../src/composition/bootstrap.js";

type IngestResult = components["schemas"]["IngestResult"];

const MERCHANT: MerchantSpec = {
  merchantId: "m_a",
  ingestKeys: ["key-a-1"],
  platformKeys: ["platform-a-1"],
  origins: ["https://a.example"],
  evidenceProfile: { returnsPolicy: true, fitData: true },
  declared: { holdoutShare: 0 },
  experiments: [
    {
      experimentId: "exp_a_000001",
      treatmentShare: 1,
      seed: "seed-a",
      status: "active",
      openedAt: "2026-09-17T00:00:00Z",
    },
  ],
  commercialPolicy: { version: "a-unavailable", interventionsPerSession: 3, cooldownSeconds: 0 },
};

const PAGE = { pageType: "product", productId: "SKU-1", variantId: "SKU-1-M" };

/** Which of the three reads cannot answer; the others answer nothing, which is a new visit. */
function past(failing: "arrivals" | "session" | "visitor" | "none"): PastActivity {
  const unavailable = <T>(what: "session" | "visitor", when: boolean, value: readonly T[]) =>
    Promise.resolve(when ? fail(new StateUnavailable(what)) : ok(value));
  return {
    arrivalsOf: () => unavailable("session", failing === "arrivals", []),
    decisionsOf: () => unavailable("session", failing === "session", []),
    decisionsOfVisitor: () => unavailable("visitor", failing === "visitor", []),
  };
}

let dir: string;
let file: string;
let app: App;

async function boot(failing: "arrivals" | "session" | "visitor" | "none"): Promise<App> {
  return startTestApp(
    {
      deployment: durableDeployment,
      ports: [replace(ClockPort, fixedClock()), replace(PastActivityPort, past(failing))],
    },
    { store: { file }, merchants: [MERCHANT] },
  );
}

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "ope-unavailable-"));
  file = path.join(dir, "ope.db");
  app = await boot("none");
  const catalogue = await putCatalog(
    app.app,
    { capturedAt: NOW, products: [catalogProductOf("SKU-1")] },
    { platformKey: "platform-a-1" },
  );
  expect(catalogue.statusCode).toBe(201);
});

afterEach(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

const rebootWith = async (failing: "arrivals" | "session" | "visitor" | "none"): Promise<void> => {
  await app.close();
  app = await boot(failing);
};

/** A batch that on its own is enough to intervene: the price dwell and the move to the button. */
const wantsToBuy = (from: number) => ({
  events: [
    eventOf(from, {
      occurredAt: NOW,
      page: PAGE,
      type: "block_dwelled",
      block: "price",
      dwellMs: 6000,
    }),
    eventOf(from + 1, { occurredAt: NOW, page: PAGE, type: "cta_approached", approach: "hover" }),
  ],
});

describe("when the durable side cannot be read (feature 032, Q1)", () => {
  it("degrades to NO_OP state-unavailable, records the decision, and does not answer an error", async () => {
    await rebootWith("session");

    const response = await postEvents(app.app, wantsToBuy(1), { key: "key-a-1" });
    // **Not a 500.** In this system a 500 means a defect; a degradation is a decision with a reason,
    // and the SDK gets its usual answer (FR-013, the precedent of `ledger-unavailable`).
    expect(response.statusCode).toBe(202);
    const { decision } = json(response) as IngestResult;
    expect(decision).toMatchObject({ outcome: "NO_OP", reason: "state-unavailable" });

    // And it is **in the ledger**, because a degraded decision is still a decision and nothing enters
    // the report without traceability (constitution IX).
    const recorded = await app
      .resolve(DecisionLedgerPort)
      .find(asMerchantId("m_a"), asDecisionId(decision.decisionId));
    expect(recorded?.outcome).toBe("NO_OP");
    expect(recorded?.reason).toBe("state-unavailable");
  });

  it("degrades the same way when it is the visitor side that cannot be read", async () => {
    // The cap that crosses visits, and the one whose failure would have no ceiling: ten failed reads
    // would be ten fresh quotas for the same person.
    await rebootWith("visitor");

    const { decision } = json(await postEvents(app.app, wantsToBuy(10), { key: "key-a-1" })) as IngestResult;
    expect(decision).toMatchObject({ outcome: "NO_OP", reason: "state-unavailable" });
  });

  it("does not call it barrier-unclear, which means something else entirely", async () => {
    // FR-014, and the reason it is a test and not a note: `barrier-unclear` means "there was not enough
    // evidence to name a barrier", which is a **finding about the visit**. Reusing it for a store that
    // did not answer would turn an infrastructure failure into a false figure of the pilot, and nothing
    // afterwards could tell the two apart.
    await rebootWith("session");

    const { decision } = json(await postEvents(app.app, wantsToBuy(20), { key: "key-a-1" })) as IngestResult;
    expect(decision.reason).not.toBe("barrier-unclear");
    expect(decision.reason).toBe("state-unavailable");
  });

  it("decides with the current batch when only the signals are unreadable, and records that they were short", async () => {
    // FR-015, the other half. The batch is enough on its own, so the decision is the one it would have
    // been — and it carries `signalsIncomplete`, which is what keeps analysis from reading this as a
    // visit where nothing happened before.
    await rebootWith("arrivals");

    const { decision } = json(await postEvents(app.app, wantsToBuy(30), { key: "key-a-1" })) as IngestResult;
    expect(decision.outcome).toBe("INTERVENE");

    const recorded = await app
      .resolve(DecisionLedgerPort)
      .find(asMerchantId("m_a"), asDecisionId(decision.decisionId));
    expect(recorded?.signalsIncomplete).toBe(true);
    // And the SDK is told nothing about it: it is a fact for the analysis, not for the client.
    expect(JSON.stringify(decision)).not.toContain("signalsIncomplete");
  });

  it("records nothing of the sort when every read answers", async () => {
    // The pair of the test above. Without it, a field that were always set would pass just as well.
    const { decision } = json(await postEvents(app.app, wantsToBuy(40), { key: "key-a-1" })) as IngestResult;
    expect(decision.outcome).toBe("INTERVENE");

    const recorded = await app
      .resolve(DecisionLedgerPort)
      .find(asMerchantId("m_a"), asDecisionId(decision.decisionId));
    expect(recorded?.signalsIncomplete).toBeUndefined();
  });
});
