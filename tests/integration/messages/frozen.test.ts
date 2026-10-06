// A text is treatment (feature 038, US3; 03 §4.10): a publication that reaches a running measurement is
// refused without a reason and restarts the window with one. What the two layers' suites already show one
// publication at a time, this one shows across them: who is reached and who is not, a run of publications,
// and the experiment that is not measuring yet.
//
// Three merchants with the same catalogue: A measures (active), B measures too, C is still calibrating.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../../src/composition/graph/index.js";
import { AdminLogPort } from "../../../src/composition/modules/admin.js";
import { ClockPort } from "../../../src/composition/modules/shared-kernel.js";
import { json } from "../../helpers/json.js";
import {
  admin,
  catalogProductOf,
  fixedClock,
  putCatalog,
  sharedTestApp,
  type MerchantSpec,
  type SharedApp,
} from "../../helpers/test-app.js";
import type { components } from "#generated/api.js";

type ExperimentPage = components["schemas"]["ExperimentPage"];
type TextVersionDto = components["schemas"]["TextVersion"];

const NOW = "2026-10-04T12:00:00.000Z";
const FAMILY = "fit.policies.reassurance";

const merchant = (id: "a" | "b" | "c", status: "active" | "calibrating"): MerchantSpec => ({
  merchantId: `m_${id}`,
  ingestKeys: [`key-${id}-1`],
  platformKeys: [`platform-${id}-1`],
  origins: [`https://${id}.example`],
  experiments: [
    { experimentId: `exp_${id}_000001`, treatmentShare: 1, seed: `seed-${id}`, status, openedAt: NOW },
  ],
});
const merchants = [merchant("a", "active"), merchant("b", "active"), merchant("c", "calibrating")];

let app: SharedApp;
beforeAll(async () => {
  app = await sharedTestApp({ ports: [replace(ClockPort, fixedClock(NOW))] }, { merchants });
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await app.resetPorts({ config: { merchants } });
  for (const id of ["a", "b", "c"] as const) {
    const res = await putCatalog(
      app.app,
      { capturedAt: NOW, products: [catalogProductOf("SKU-1", 2)] },
      { platformKey: `platform-${id}-1` },
    );
    expect(res.statusCode).toBe(201);
  }
});

const publishBase = (over: Record<string, unknown>) =>
  admin(app.app, "POST", "/v1/admin/texts", {
    body: { family: FAMILY, locale: "es", text: "The base, reworded.", ...over },
  });
const publishOwn = (id: "a" | "b" | "c", over: Record<string, unknown>) =>
  admin(app.app, "POST", `/v1/admin/merchants/m_${id}/texts`, {
    body: { family: FAMILY, locale: "es", text: `Own words of ${id}.`, ...over },
  });
const restartsOf = async (id: "a" | "b" | "c") => {
  const page = json(await admin(app.app, "GET", `/v1/admin/merchants/m_${id}/experiments`)) as ExperimentPage;
  return page.items[0]?.windowRestarts ?? [];
};

describe("a text that reaches a running measurement (US3)", () => {
  it("a base text without a reason is frozen by any active experiment, and with one restarts every reached window, naming the text", async () => {
    expect((await publishBase({})).statusCode).toBe(409);
    const accepted = await publishBase({ corrective: true, reason: "a clearer promise" });
    expect(accepted.statusCode).toBe(201);
    expect((json(accepted) as TextVersionDto).windowsRestarted).toEqual(["exp_a_000001", "exp_b_000001"]);
    const cause = { at: NOW, reason: "a clearer promise", level: "defaults", configurationVersion: 2 };
    expect(await restartsOf("a")).toEqual([
      { ...cause, text: { family: FAMILY, locale: "es", layer: "base" } },
    ]);
    expect(await restartsOf("b")).toEqual([
      { ...cause, text: { family: FAMILY, locale: "es", layer: "base" } },
    ]);
    const log = await app.resolve(AdminLogPort).list({ limit: 1 });
    expect(log.items[0]).toMatchObject({ operation: "publishText", reason: "a clearer promise" });
  });

  it("an experiment still calibrating is not measuring: it neither freezes the text nor restarts", async () => {
    // Only C exists with a text of its own, so nothing reached is active... except that A and B are: give
    // them their own text first, so the base reaches C alone.
    for (const id of ["a", "b"] as const) {
      expect((await publishOwn(id, { corrective: true, reason: "own" })).statusCode).toBe(201);
    }
    const base = await publishBase({});
    expect(base.statusCode).toBe(201);
    expect((json(base) as TextVersionDto).windowsRestarted).toBeUndefined();
    expect(await restartsOf("c")).toEqual([]);
    // C's own text, likewise: no reason asked, no window restarted.
    expect((await publishOwn("c", {})).statusCode).toBe(201);
    expect(await restartsOf("c")).toEqual([]);
  });

  it("a merchant's text reaches only its own experiment, and a merchant with its own text is out of the base's reach", async () => {
    expect((await publishOwn("a", {})).statusCode).toBe(409);
    const own = await publishOwn("a", { corrective: true, reason: "A's words" });
    expect(own.statusCode).toBe(201);
    expect((json(own) as TextVersionDto).windowsRestarted).toEqual(["exp_a_000001"]);
    expect(await restartsOf("b")).toEqual([]);
    // Now the base reaches B only: A shows its own text and nothing of the base changes for it.
    const base = await publishBase({ corrective: true, reason: "the base" });
    expect((json(base) as TextVersionDto).windowsRestarted).toEqual(["exp_b_000001"]);
    expect(await restartsOf("a")).toHaveLength(1);
    expect((await restartsOf("a"))[0]?.text).toEqual({ family: FAMILY, locale: "es", layer: "m_a" });
  });

  it("ten publications in a row each ask their reason and each restart the window; the last one is the one in force", async () => {
    for (let n = 1; n <= 10; n += 1) {
      const response = await publishBase({ text: `Wording ${n}.`, corrective: true, reason: `round ${n}` });
      expect(response.statusCode, `round ${n}`).toBe(201);
    }
    const restarts = await restartsOf("a");
    expect(restarts).toHaveLength(10);
    expect(restarts[9]).toMatchObject({ reason: "round 10", configurationVersion: 11 });
    const page = json(await admin(app.app, "GET", "/v1/admin/merchants/m_a/experiments")) as ExperimentPage;
    expect(page.items[0]?.windowStartedAt).toBe(NOW);
  });
});
