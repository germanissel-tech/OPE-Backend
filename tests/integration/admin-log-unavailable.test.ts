// Feature 021, US3 (FR-009, FR-010; ADR-034 amended 2026-09-23): an administration action that
// cannot be audited does not happen.
//
// **What this file asserts changed with feature 034, and the reason is worth reading before touching it.**
// It used to assert two things per test — the `503` and that the system was exactly as it was — because
// the rule was kept by asking the trail **before** acting, which in this deployment meant nothing ran.
// Now the rule is kept by a unit of work that reverts, and a deployment whose ledgers are maps in this
// process **cannot revert**: it reports the failure and leaves what was written (`transientUnitOfWork`
// says so in full).
//
// So the half that says "and nothing happened" moved to `tests/durability/atomic-audit.test.ts`, where it
// is a **stronger** claim than it ever was here: there the trail can fail *during* the action, which is
// the case the previous mechanism could not even express. What stays here is the half this deployment can
// still prove, and it is not a small one — an operator is told `503` and not `201`, which is the mistake
// the first version of the unit of work made and this suite caught.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { AdminLogPort } from "../../src/composition/modules/admin.js";
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

describe("an administration action with the log refusing writes", () => {
  it("creating a merchant answers 503 and not the 201 of an action nobody audited", async () => {
    const res = await admin(app.app, "POST", "/v1/admin/merchants", {
      body: { origins: ["https://new.example"], signature: false },
    });
    expect(res.statusCode).toBe(503);
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:store-unavailable" });
  });

  it("rotating a credential answers 503, so its value never reaches the operator", async () => {
    // The response of a rotation carries the new credential **once**: answering anything but a failure
    // would hand out a secret for a rotation that was not audited.
    const res = await admin(app.app, "POST", `/v1/admin/merchants/${A}/ingest-keys`, {
      body: { graceSeconds: 3600 },
    });
    expect(res.statusCode).toBe(503);
  });

  it("flipping the kill switch answers 503", async () => {
    const res = await admin(app.app, "PUT", `/v1/admin/merchants/${A}/kill-switch`, {
      body: { enabled: false },
    });
    expect(res.statusCode).toBe(503);
  });

  it("a read of the administration is not affected: it writes no entry", async () => {
    const res = await admin(app.app, "GET", `/v1/admin/merchants/${A}`);
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({ merchantId: A });
  });
});

describe("the boot itself", () => {
  it("does not finish starting when the log refuses from the start", async () => {
    // The seed imports as the `system` operator, which is an administration action: if it cannot be audited
    // it does not happen, and a server with no merchants authenticates nobody. Failing loudly beats starting
    // with a platform nobody can explain the origin of.
    //
    // **The first thing the seed imports is the two levels of the release** (feature 036), because everything
    // below is judged against them — so that is the import the refusing log stops first. Which one it names
    // is not the point; that the boot does not finish is.
    const refusing = unavailableAdminLog();
    await expect(
      startTestApp({ ports: [replace(AdminLogPort, refusing), replace(AuditTrailPort, refusing)] }),
    ).rejects.toThrow("The configuration levels seed was rejected: store-unavailable.");
  });
});
