// Publishing a base text by API (feature 038, US1), over HTTP and end to end.
//
// **What it is really about is that the change counts on the next intervention without a restart.** Until
// this feature the texts travelled with the release, so correcting one meant a deploy — which changes a
// treatment in course the same way, leaves no version, no entry in the administration log and restarts no
// measurement window. Here the same correction is a numbered version of one key, and the intervention
// right after it shows it and stamps it.
//
// The merchant of the seed opens an active experiment and has no text of its own, so every publication
// below reaches a running measurement: that is the ordinary case of a platform with traffic, and why the
// publications carry their reason.
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
type TextVersionDto = components["schemas"]["TextVersion"];
type ExperimentPage = components["schemas"]["ExperimentPage"];

const NOW = "2026-10-04T12:00:00.000Z";
const KEY = "key-a-1";
const FAMILY = "fit.variant_selector.information";
const PAGE = { pageType: "product", productId: "SKU-1", variantId: "SKU-1-M", locale: "es" };

const treatment: MerchantSpec = {
  merchantId: "m_a",
  ingestKeys: [KEY],
  platformKeys: ["platform-a-1"],
  origins: ["https://a.example"],
  experiments: [
    { experimentId: "exp_a_000001", treatmentShare: 1, seed: "seed-a", status: "active", openedAt: NOW },
  ],
};

let app: SharedApp;
beforeAll(async () => {
  app = await sharedTestApp({ ports: [replace(ClockPort, fixedClock(NOW))] }, { merchants: [treatment] });
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await app.resetPorts({ config: { merchants: [treatment] } });
  const res = await putCatalog(
    app.app,
    { capturedAt: NOW, products: [catalogProductOf("SKU-1", 2)] },
    { platformKey: "platform-a-1" },
  );
  expect(res.statusCode).toBe(201);
});

let n = 0;
const at = (seconds: number) => new Date(Date.parse(NOW) + seconds * 1000).toISOString();
const ev = (seconds: number, over: Record<string, unknown>) =>
  eventOf(++n, { occurredAt: at(seconds), page: PAGE, ...over });

/** A session that earns the size information: two selector interactions and the size guide. */
async function intervention(session = `ses_${String(++n).padStart(8, "0")}`): Promise<IngestResult> {
  const events = [
    ev(1, { type: "variant_selector_interacted" }),
    ev(2, { type: "variant_selector_interacted" }),
    ev(3, { type: "block_dwelled", block: "specifications", dwellMs: 6000 }),
  ].map((e) => ({ ...e, sessionId: session }));
  const res = await postEvents(app.app, { events }, { key: KEY });
  expect(res.statusCode).toBe(202);
  return json(res) as IngestResult;
}

const publish = (body: Record<string, unknown>, as?: "ops-a") =>
  admin(app.app, "POST", "/v1/admin/texts", { body, ...(as === undefined ? {} : { as }) });

const base = (over: Record<string, unknown> = {}) => ({
  family: FAMILY,
  locale: "es",
  text: "Sizes vary between brands: check the guide before choosing.",
  corrective: true,
  reason: "wording",
  ...over,
});

describe("publishing a base text (US1)", () => {
  it("numbers the version, shows it on the next intervention with its identifier, and leaves its entry in the log", async () => {
    const before = await intervention();
    expect(before.decision.intervention?.messageVersionId).toBe(corpusEntryOf(FAMILY).version);

    const response = await publish(base());
    expect(response.statusCode).toBe(201);
    const version = json(response) as TextVersionDto;
    expect(version).toMatchObject({
      family: FAMILY,
      locale: "es",
      layer: "base",
      version: 2,
      messageVersionId: `base/${FAMILY}/-/es#2`,
      text: "Sizes vary between brands: check the guide before choosing.",
      removed: false,
      corrective: true,
      reason: "wording",
      operatorId: "ops-all",
      windowsRestarted: ["exp_a_000001"],
    });

    // **The next intervention, without a restart**: the text and the version it stamps are the new ones.
    const after = await intervention();
    expect(after.decision.intervention).toMatchObject({
      messageVersionId: `base/${FAMILY}/-/es#2`,
      text: "Sizes vary between brands: check the guide before choosing.",
    });

    const log = await app.resolve(AdminLogPort).list({ limit: 1 });
    expect(log.items[0]).toMatchObject({
      operation: "publishText",
      operatorId: "ops-all",
      outcome: "accepted",
      reason: "wording",
      result: { windowRestarted: true },
    });
    // The experiment says which text restarted its window: the key and the layer, and the version as the
    // number of that key in that layer.
    const page = json(await admin(app.app, "GET", "/v1/admin/merchants/m_a/experiments")) as ExperimentPage;
    expect(page.items[0]?.windowRestarts).toEqual([
      {
        at: NOW,
        reason: "wording",
        level: "defaults",
        configurationVersion: 2,
        text: { family: FAMILY, locale: "es", layer: "base" },
      },
    ]);
  });

  it("a text that speaks of an attribute is keyed by its value, in the version and in the restart it causes", async () => {
    const spoken = { family: "fit.variant_selector.uncertainty", attributeValue: "linen" };
    const response = await publish(
      base({ ...spoken, text: "Linen stretches with use: size down if in doubt." }),
    );
    expect(response.statusCode).toBe(201);
    expect(json(response)).toMatchObject({
      ...spoken,
      messageVersionId: `base/${spoken.family}/linen/es#2`,
      text: "Linen stretches with use: size down if in doubt.",
    });
    const page = json(await admin(app.app, "GET", "/v1/admin/merchants/m_a/experiments")) as ExperimentPage;
    expect(page.items[0]?.windowRestarts[0]?.text).toEqual({ ...spoken, locale: "es", layer: "base" });
  });

  it("repeats the version in force when the text is identical, instead of creating another", async () => {
    expect((await publish(base())).statusCode).toBe(201);
    const again = await publish(
      base({ text: "  Sizes vary between brands: check the guide before choosing. " }),
    );
    expect(again.statusCode).toBe(200);
    expect(json(again)).toMatchObject({ version: 2, messageVersionId: `base/${FAMILY}/-/es#2` });
  });

  it("refuses a text that is blank, too long or still a template, naming the rule, and creates no version [invariant:corpus-text-empty] [invariant:corpus-text-too-long] [invariant:corpus-text-has-placeholder]", async () => {
    for (const [text, type] of [
      ["   ", "corpus-text-empty"],
      ["x".repeat(513), "corpus-text-too-long"],
      ["Size {size} may vary.", "corpus-text-has-placeholder"],
    ] as const) {
      const response = await publish(base({ text }));
      // A text longer than the schema allows is stopped by the schema itself (400); the other two reach the rule.
      if (type === "corpus-text-too-long") {
        expect(response.statusCode, text.length.toString()).toBe(400);
        continue;
      }
      expect(response.statusCode, type).toBe(422);
      expect((json(response) as { type: string }).type).toBe(`urn:ope:problem:${type}`);
    }
    expect((await intervention()).decision.intervention?.messageVersionId).toBe(
      corpusEntryOf(FAMILY).version,
    );
  });

  it("refuses a family or a value outside OPE's vocabulary: the API never creates keys [invariant:text-key-unknown]", async () => {
    const stray = await publish(base({ family: "fit.variant_selector.typo" }));
    expect(stray.statusCode).toBe(422);
    expect(json(stray)).toMatchObject({
      type: "urn:ope:problem:text-key-unknown",
      errors: [{ pointer: "/family" }],
    });
    // A value on a family that speaks of nothing of the product is a key no text can have either.
    const misplaced = await publish(base({ attributeValue: "linen" }));
    expect(misplaced.statusCode).toBe(422);
    expect((json(misplaced) as { type: string }).type).toBe("urn:ope:problem:text-key-unknown");
  });

  it("accepts a text in a language no level supports yet: the base of a language can be completed first", async () => {
    const response = await publish(base({ locale: "pt-BR", text: "Sizes vary between brands, in pt-BR." }));
    expect(response.statusCode).toBe(201);
    expect(json(response)).toMatchObject({
      locale: "pt-BR",
      version: 1,
      messageVersionId: `base/${FAMILY}/-/pt-BR#1`,
    });
  });

  it("refuses an operator whose scope is a list, because a base text reaches every merchant", async () => {
    const response = await publish(base(), "ops-a");
    expect(response.statusCode).toBe(403);
    expect((json(response) as { type: string }).type).toBe("urn:ope:problem:operator-scope-too-narrow");
    const log = await app.resolve(AdminLogPort).list({ limit: 1 });
    expect(log.items[0]).toMatchObject({ operation: "publishText", outcome: "denied" });
  });

  it("without a reason, a text that reaches an active experiment is frozen; with one, it restarts the window", async () => {
    // Declared not corrective, or not declared at all: a version is corrective only when it says so.
    for (const corrective of [false, undefined]) {
      const frozen = await publish(base({ corrective, reason: undefined }));
      expect(frozen.statusCode).toBe(409);
      expect((json(frozen) as { type: string }).type).toBe("urn:ope:problem:configuration-frozen");
    }
    expect((await intervention()).decision.intervention?.messageVersionId).toBe(
      corpusEntryOf(FAMILY).version,
    );
  });

  it("a corrective text without its reason is refused before anything is written", async () => {
    const response = await publish(base({ reason: undefined }));
    expect(response.statusCode).toBe(422);
    expect((json(response) as { type: string }).type).toBe("urn:ope:problem:configuration-reason-required");
  });
});
