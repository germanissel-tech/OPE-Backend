// The whole server across a restart, through HTTP and nothing else. The other suites here build a
// gateway by hand; this one proves the thing the feature is actually about: **a deploy happens and
// OPE still knows what it decided.**
//
// It is also the only test that runs the durable deployment end to end, so it is what would catch
// a store the boot cannot open, a module left out of the list, or a seed that stops working once
// something is persisted.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { durableDeployment } from "../../src/composition/deployments/durable.js";
import { replace } from "../../src/composition/graph/index.js";
import { DecisionLedgerPort } from "../../src/composition/modules/ledger.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { asDecisionId } from "../../src/domain/ledger/index.js";
import { asMerchantId, asSessionId } from "../../src/domain/shared-kernel/index.js";
import { json } from "../helpers/json.js";
import { batchOf, fixedClock, postEvents, startTestApp } from "../helpers/test-app.js";
import type { components } from "#generated/api.js";
import type { App } from "../../src/composition/bootstrap.js";

type IngestResult = components["schemas"]["IngestResult"];

const MERCHANT = asMerchantId("m_a");

let dir: string;
let file: string;
let app: App;

/**
 * A boot of the server on the same file: what a deploy or a crash and a start again amount to.
 * The clock is fixed because the batches of the helpers are dated, not because anything here is
 * about time — with the real clock every event is too far in the past to be accepted.
 */
async function boot(): Promise<App> {
  return startTestApp(
    { deployment: durableDeployment, ports: [replace(ClockPort, fixedClock())] },
    { store: { file } },
  );
}

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "ope-restart-"));
  file = path.join(dir, "ope.db");
  app = await boot();
});

afterEach(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("the server across a restart", () => {
  it("starts on an empty store, and a ledger with no records is a valid ledger", async () => {
    // The edge case of the spec: nothing recorded yet is not an error, and the server answers.
    const decisions = app.resolve(DecisionLedgerPort);
    expect(await decisions.bySession(MERCHANT, asSessionId("ses_00000001"))).toEqual([]);
  });

  it("still knows the decision it took before the restart", async () => {
    const response = await postEvents(app.app, batchOf(1, 1), { key: "key-a-1" });
    expect(response.statusCode).toBe(202);
    const { decision } = json(response) as IngestResult;

    await app.close();
    app = await boot();

    const found = await app.resolve(DecisionLedgerPort).find(MERCHANT, asDecisionId(decision.decisionId));
    expect(found?.decisionId).toBe(decision.decisionId);
    expect(found?.outcome).toBe(decision.outcome);
    expect(found?.reason).toBe(decision.reason);
  });

  it("re-imports the seed onto a store that already holds the ledger, and starts", async () => {
    await postEvents(app.app, batchOf(1, 1), { key: "key-a-1" });

    await app.close();
    app = await boot();

    // The merchants and experiments are rebuilt from the seed at every start and are *not*
    // durable yet (spec, "what this feature does not do"). Booting a second time over a store
    // that is no longer empty is where that combination would break, so it is asserted: the
    // server answers a request signed with the same key as before.
    const again = await postEvents(app.app, batchOf(2, 1), { key: "key-a-1" });
    expect(again.statusCode).toBe(202);
  });
});
