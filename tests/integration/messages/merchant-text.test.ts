// A merchant's own text by API (feature 038, US2), over HTTP and end to end: published, resolved before
// the base inside its language and only for that merchant, and removed as a version that sends the key
// back to the base.
//
// Two merchants with the same catalogue and the same experiment, so the only difference between what
// their interventions say is the layer: A gets its own text, B keeps the base. **The language rules over
// the personalisation**: A's page in English shows the base in English, not A's Spanish text.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../../src/composition/graph/index.js";
import { AdminLogPort } from "../../../src/composition/modules/admin.js";
import { ClockPort } from "../../../src/composition/modules/shared-kernel.js";
import { json } from "../../helpers/json.js";
import { corpusEntryOf } from "../../helpers/sayable.js";
import {
  admin,
  catalogProductOf,
  eventOf,
  fixedClock,
  postEvents,
  putCatalog,
  sharedTestApp,
  type MerchantSpec,
  type SharedApp,
} from "../../helpers/test-app.js";
import type { components } from "#generated/api.js";

type IngestResult = components["schemas"]["IngestResult"];

const NOW = "2026-10-04T12:00:00.000Z";
const FAMILY = "fit.variant_selector.information";

const merchant = (id: "a" | "b"): MerchantSpec => ({
  merchantId: `m_${id}`,
  ingestKeys: [`key-${id}-1`],
  platformKeys: [`platform-${id}-1`],
  origins: [`https://${id}.example`],
  // Both serve Spanish and English, with Spanish as the reserve, so an English page resolves in English.
  declared: { locales: { supported: ["es", "en"], fallback: "es" } },
  experiments: [
    {
      experimentId: `exp_${id}_000001`,
      treatmentShare: 1,
      seed: `seed-${id}`,
      status: "active",
      openedAt: NOW,
    },
  ],
});
const merchants = [merchant("a"), merchant("b")];

let app: SharedApp;
beforeAll(async () => {
  app = await sharedTestApp({ ports: [replace(ClockPort, fixedClock(NOW))] }, { merchants });
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await app.resetPorts({ config: { merchants } });
  for (const id of ["a", "b"] as const) {
    const res = await putCatalog(
      app.app,
      { capturedAt: NOW, products: [catalogProductOf("SKU-1", 2)] },
      { platformKey: `platform-${id}-1` },
    );
    expect(res.statusCode).toBe(201);
  }
  // Both base texts the cases compare against: Spanish comes with the seed, English is published here.
  const english = await publishBase({ locale: "en", text: "Sizes vary between brands: check the guide." });
  expect(english.statusCode).toBe(201);
});

let n = 0;
const at = (seconds: number) => new Date(Date.parse(NOW) + seconds * 1000).toISOString();

/** A session of the merchant that earns the size information, with the page in `locale`. */
async function intervention(id: "a" | "b", locale = "es"): Promise<IngestResult> {
  const session = `ses_${String(++n).padStart(8, "0")}`;
  const page = { pageType: "product", productId: "SKU-1", variantId: "SKU-1-M", locale };
  const events = [
    eventOf(++n, { occurredAt: at(1), page, type: "variant_selector_interacted" }),
    eventOf(++n, { occurredAt: at(2), page, type: "variant_selector_interacted" }),
    eventOf(++n, { occurredAt: at(3), page, type: "block_dwelled", block: "specifications", dwellMs: 6000 }),
  ].map((e) => ({ ...e, sessionId: session }));
  const res = await postEvents(app.app, { events }, { key: `key-${id}-1` });
  expect(res.statusCode).toBe(202);
  return json(res) as IngestResult;
}

const publishBase = (over: Record<string, unknown>) =>
  admin(app.app, "POST", "/v1/admin/texts", {
    body: { family: FAMILY, locale: "es", corrective: true, reason: "base", ...over },
  });

const publishOwn = (id: "a" | "b", body: Record<string, unknown>, as?: "ops-a") =>
  admin(app.app, "POST", `/v1/admin/merchants/m_${id}/texts`, {
    body: { family: FAMILY, locale: "es", corrective: true, reason: "own wording", ...body },
    ...(as === undefined ? {} : { as }),
  });

const OWN = "In this shop sizes run small: check the guide before choosing.";

describe("a merchant's own text (US2)", () => {
  it("is shown to that merchant and to nobody else, and the base keeps serving the others", async () => {
    const response = await publishOwn("a", { text: OWN });
    expect(response.statusCode).toBe(201);
    expect(json(response)).toMatchObject({
      layer: "m_a",
      version: 1,
      messageVersionId: `m_a/${FAMILY}/-/es#1`,
      removed: false,
      windowsRestarted: ["exp_a_000001"],
    });

    expect((await intervention("a")).decision.intervention).toMatchObject({
      messageVersionId: `m_a/${FAMILY}/-/es#1`,
      text: OWN,
    });
    expect((await intervention("b")).decision.intervention?.messageVersionId).toBe(
      corpusEntryOf(FAMILY).version,
    );
  });

  it("the language rules over the personalisation: the page in English shows the base in English", async () => {
    expect((await publishOwn("a", { text: OWN })).statusCode).toBe(201);
    expect((await intervention("a", "en")).decision.intervention).toMatchObject({
      messageVersionId: `base/${FAMILY}/-/en#1`,
      text: "Sizes vary between brands: check the guide.",
    });
  });

  it("removing the text is a version in the history, and the next intervention shows the base again", async () => {
    expect((await publishOwn("a", { text: OWN })).statusCode).toBe(201);
    const removed = await publishOwn("a", { remove: true });
    expect(removed.statusCode).toBe(201);
    expect(json(removed)).toMatchObject({ layer: "m_a", version: 2, removed: true });
    expect((json(removed) as { text?: string }).text).toBeUndefined();
    expect((await intervention("a")).decision.intervention?.messageVersionId).toBe(
      corpusEntryOf(FAMILY).version,
    );
    // Removing again repeats the removal in force instead of minting a third version.
    const again = await publishOwn("a", { remove: true });
    expect(again.statusCode).toBe(200);
    expect(json(again)).toMatchObject({ version: 2, removed: true });
  });

  it("refuses an operator whose scope does not cover the merchant, and the log says it was denied", async () => {
    const response = await publishOwn("b", { text: OWN }, "ops-a");
    expect(response.statusCode).toBe(403);
    expect((json(response) as { type: string }).type).toBe("urn:ope:problem:merchant-out-of-scope");
    const log = await app.resolve(AdminLogPort).list({ limit: 1 });
    expect(log.items[0]).toMatchObject({
      operation: "publishMerchantText",
      outcome: "denied",
      merchantId: "m_b",
    });
  });

  it("a merchant with its own text is not reached by a new base text: its text keeps winning, the other's changes", async () => {
    expect((await publishOwn("a", { text: OWN })).statusCode).toBe(201);
    const base = await publishBase({ text: "Base, corrected." });
    expect(base.statusCode).toBe(201);
    // Only B's experiment restarted: A shows its own text and the base change does not reach it.
    expect((json(base) as { windowsRestarted?: string[] }).windowsRestarted).toEqual(["exp_b_000001"]);
    expect((await intervention("a")).decision.intervention?.text).toBe(OWN);
    expect((await intervention("b")).decision.intervention?.text).toBe("Base, corrected.");
  });

  it("without a reason, a text that reaches the merchant's active experiment is frozen", async () => {
    const frozen = await publishOwn("a", { text: OWN, corrective: false, reason: undefined });
    expect(frozen.statusCode).toBe(409);
    expect((json(frozen) as { type: string }).type).toBe("urn:ope:problem:configuration-frozen");
  });
});
