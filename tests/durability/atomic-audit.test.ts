// An administration action and its audit entry as one fact (feature 034, SC-001), through the real durable
// deployment and HTTP.
//
// **This is the window ADR-034 declared open, closed.** The rule —an action that could not be audited did
// not happen— used to be kept by asking the trail before acting, which covers a trail that is already
// refusing and nothing else. What it could not express is the case that costs: **the trail failing while
// the action runs**, leaving a merchant created and nobody's name on it. That case is the first test here,
// and it could not be written before this feature.
//
// It lives in the durability suite and not in `fast` because reverting needs something to revert: the
// in-memory deployment has maps, reports the failure and keeps what was written
// (`transientUnitOfWork` says so in full). What that deployment can still prove is asserted in
// `tests/integration/admin-log-unavailable.test.ts`.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { durableDeployment } from "../../src/composition/deployments/durable.js";
import { replace } from "../../src/composition/graph/index.js";
import { AdminLogPort } from "../../src/composition/modules/admin.js";
import { MerchantStorePort } from "../../src/composition/modules/merchant.js";
import { AuditTrailPort, ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { json } from "../helpers/json.js";
import { admin, fixedClock, startTestApp } from "../helpers/test-app.js";
import { refusingAdminLog, unavailableAdminLog } from "../helpers/unavailable-ledgers.js";
import type { App } from "../../src/composition/bootstrap.js";

const A = asMerchantId("m_a");

let dir: string;
let file: string;
let app: App;

/**
 * A boot of the durable deployment whose trail can be told to refuse **after** it started: the seed is an
 * administration action, so a trail that refuses from the boot is a different test (the last one here).
 */
async function boot(refusing?: { log: Parameters<typeof replace>[1] }): Promise<App> {
  const ports = refusing ? [replace(AdminLogPort, refusing.log), replace(AuditTrailPort, refusing.log)] : [];
  return startTestApp(
    { deployment: durableDeployment, ports: [replace(ClockPort, fixedClock()), ...ports] },
    { store: { file } },
  );
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "ope-atomic-"));
  file = path.join(dir, "ope.db");
});

afterEach(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

/** What the store holds right now, read past the API so the assertion does not depend on it. */
const merchants = () => app.resolve(MerchantStorePort);

describe("an action and its audit entry are one fact (SC-001)", () => {
  it("leaves nothing of the action when the trail fails while it runs", async () => {
    // **The case this feature exists for, and the one the previous mechanism could not express.** The
    // trail accepts when the action starts and refuses by the time the entry is written, which is what a
    // disk filling up during a request looks like.
    const refusing = refusingAdminLog();
    app = await boot(refusing);
    const before = (await merchants().list({ limit: 50 })).items.length;
    refusing.refuse();

    const response = await admin(app.app, "POST", "/v1/admin/merchants", {
      body: { origins: ["https://reverted.example"], signature: false, displayName: "Atomic" },
    });

    expect(response.statusCode).toBe(503);
    // The merchant is not there, and neither is the origin it would have reserved — which is the half
    // that would keep somebody else from ever registering it.
    expect((await merchants().list({ limit: 50 })).items.length).toBe(before);
    expect(await merchants().ownerOfOrigin("https://reverted.example")).toBeUndefined();

    await app.close();
    app = await boot();
    expect(await merchants().ownerOfOrigin("https://reverted.example")).toBeUndefined();
  });

  it("keeps the action and its entry together when the trail accepts, across a restart", async () => {
    app = await boot();

    const response = await admin(app.app, "POST", "/v1/admin/merchants", {
      body: { origins: ["https://kept.example"], signature: false, displayName: "Atomic" },
    });
    expect(response.statusCode).toBe(201);
    const created = (json(response) as { merchant: { merchantId: string } }).merchant.merchantId;

    await app.close();
    app = await boot();

    expect((await merchants().get(asMerchantId(created)))?.merchantId).toBe(created);
    const log = await admin(app.app, "GET", "/v1/admin/log?limit=10");
    const entries = (json(log) as { items: { operation: string; merchantId?: string }[] }).items;
    expect(entries.some((e) => e.operation === "createMerchant" && e.merchantId === created)).toBe(true);
  });

  it("answers the merchant it just created **without a restart**", async () => {
    // The half that a restart hides, and the mutation gate is what pointed at it: the merchants answer
    // their reads from an in-memory index (ADR-041), and inside a unit that index must not change until
    // the store commits. A gateway that deferred it and then forgot to run it would pass every test that
    // reads after rebooting — and authenticate nobody until the next deploy.
    app = await boot();

    const response = await admin(app.app, "POST", "/v1/admin/merchants", {
      body: { origins: ["https://at-once.example"], signature: false, displayName: "Atomic" },
    });
    expect(response.statusCode).toBe(201);
    const created = (json(response) as { merchant: { merchantId: string } }).merchant.merchantId;

    // Same process, no restart: the index has it, and so does the origin it reserved.
    expect((await merchants().get(asMerchantId(created)))?.merchantId).toBe(created);
    expect(await merchants().ownerOfOrigin("https://at-once.example")).toBe(created);
  });

  it("keeps the entry of an action a business rule refused, because that also happened", async () => {
    // A rejection is a failed `Result` too, so a unit that reverted on any failure would erase exactly
    // the entry an operator goes looking for. The action wrote nothing; the entry is the whole record.
    app = await boot();
    const first = await admin(app.app, "POST", "/v1/admin/merchants", {
      body: { origins: ["https://taken.example"], signature: false, displayName: "Atomic" },
    });
    expect(first.statusCode).toBe(201);

    const clash = await admin(app.app, "POST", "/v1/admin/merchants", {
      body: { origins: ["https://taken.example"], signature: false, displayName: "Atomic" },
    });
    expect(clash.statusCode).toBe(422);

    await app.close();
    app = await boot();

    const log = await admin(app.app, "GET", "/v1/admin/log?limit=10");
    const entries = (json(log) as { items: { operation: string; outcome: string }[] }).items;
    expect(entries.filter((e) => e.operation === "createMerchant" && e.outcome === "rejected")).toHaveLength(
      1,
    );
  });

  it("reverts only what the action wrote, and touches nothing of another merchant", async () => {
    // Constitution V through a reversion: the unit is of the process, so what it undoes has to be what
    // this action wrote and nothing that was already there — least of all another merchant's.
    const refusing = refusingAdminLog();
    app = await boot(refusing);
    const untouched = await merchants().get(A);
    expect(untouched).toBeDefined();
    refusing.refuse();

    const response = await admin(app.app, "PUT", `/v1/admin/merchants/${A}/kill-switch`, {
      body: { enabled: false },
    });
    expect(response.statusCode).toBe(503);

    await app.close();
    app = await boot();

    // The switch did not move, and the other merchant of the seed is exactly as it was.
    expect((await merchants().get(A))?.isOn()).toBe(untouched?.isOn());
    expect((await merchants().list({ limit: 50 })).items).toHaveLength(2);
  });

  it("does not finish starting when the trail refuses from the boot", async () => {
    // The seed is an administration action, so the rule reaches the boot: a server with no merchants
    // authenticates nobody, and failing loudly beats starting with a platform nobody can explain.
    const refusing = unavailableAdminLog();
    await expect(
      startTestApp(
        {
          deployment: durableDeployment,
          ports: [
            replace(ClockPort, fixedClock()),
            replace(AdminLogPort, refusing),
            replace(AuditTrailPort, refusing),
          ],
        },
        { store: { file } },
      ),
      // The first thing the seed imports is the two levels of the release (feature 036), so that is the
      // import a refusing trail stops first. Which one it names is not the claim; that it does not start is.
    ).rejects.toThrow("The configuration levels seed was rejected: store-unavailable.");
    // Nothing is left running to close; the fixture's teardown needs an app, so one is booted clean.
    app = await boot();
  });
});
