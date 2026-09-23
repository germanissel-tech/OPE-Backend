// Feature 021, US3 (FR-009, FR-010; ADR-034 amended 2026-09-23): an administration action that
// cannot be audited does not happen.
//
// Every test here asserts **two** things, and the second is the one that matters: the response
// says 503, and the system is exactly as it was. Asserting only the status would pass against an
// implementation that audits after acting — which is the very thing the decision rules out,
// because it would tell the operator that nothing happened when something did.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { AdminLogPort } from "../../src/composition/modules/admin.js";
import { MerchantStorePort } from "../../src/composition/modules/merchant.js";
import { AuditTrailPort } from "../../src/composition/modules/shared-kernel.js";
import { asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { json, problemOf } from "../helpers/json.js";
import { admin, sharedTestApp, startTestApp, type SharedApp } from "../helpers/test-app.js";
import { refusingAdminLog, unavailableAdminLog } from "../helpers/unavailable-ledgers.js";

const A = asMerchantId("m_a");

let app: SharedApp;
beforeAll(async () => {
  app = await sharedTestApp();
});
afterAll(() => app.close());
let refuse: () => void;
beforeEach(async () => {
  // The log starts writable and refuses after the boot. The seed of the boot is an administration
  // action too, so a server whose log refuses from the start never finishes starting — the same
  // decision one step earlier, asserted at the end of this file.
  //
  // The log and the audit trail are two views of one instance (ADR-034), and a replacement is of
  // one component, not of a binding: both have to be replaced or the decorator keeps the real one.
  const refusing = refusingAdminLog();
  refuse = refusing.refuse;
  await app.resetPorts({
    ports: [replace(AdminLogPort, refusing.log), replace(AuditTrailPort, refusing.log)],
  });
  refuse();
});

/** What the store holds right now, read past the API so the assertion does not depend on it. */
const merchants = () => app.resolve(MerchantStorePort);

describe("an administration action with the log refusing writes", () => {
  it("creating a merchant answers 503 and the merchant does not exist", async () => {
    const before = (await merchants().list({ limit: 50 })).items.length;
    const res = await admin(app.app, "POST", "/v1/admin/merchants", {
      body: { origins: ["https://new.example"], signature: false },
    });
    expect(res.statusCode).toBe(503);
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:store-unavailable" });
    expect((await merchants().list({ limit: 50 })).items.length).toBe(before);
  });

  it("rotating a credential answers 503 and no credential was minted", async () => {
    const before = (await merchants().get(A))?.credentials.length;
    const res = await admin(app.app, "POST", `/v1/admin/merchants/${A}/ingest-keys`, {
      body: { graceSeconds: 3600 },
    });
    expect(res.statusCode).toBe(503);
    expect((await merchants().get(A))?.credentials.length).toBe(before);
  });

  it("flipping the kill switch answers 503 and the switch did not move", async () => {
    const before = (await merchants().get(A))?.isOn();
    const res = await admin(app.app, "PUT", `/v1/admin/merchants/${A}/kill-switch`, {
      body: { enabled: false },
    });
    expect(res.statusCode).toBe(503);
    expect((await merchants().get(A))?.isOn()).toBe(before);
  });

  it("a read of the administration is not affected: it writes no entry", async () => {
    const res = await admin(app.app, "GET", `/v1/admin/merchants/${A}`);
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({ merchantId: A });
  });
});

describe("the boot itself", () => {
  it("does not finish starting when the log refuses from the start", async () => {
    // The seed imports merchants as the `system` operator, which is an administration action: if
    // it cannot be audited it does not happen, and a server with no merchants authenticates
    // nobody. Failing loudly beats starting with a platform nobody can explain the origin of.
    const refusing = unavailableAdminLog();
    await expect(
      startTestApp({ ports: [replace(AdminLogPort, refusing), replace(AuditTrailPort, refusing)] }),
    ).rejects.toThrow("The merchant seed was rejected: store-unavailable.");
  });
});
