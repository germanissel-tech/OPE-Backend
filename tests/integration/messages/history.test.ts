// The history of a key (feature 038, US5; FR-016, FR-017), over HTTP: every version of a key in a layer,
// newest first, and one version as it was published — including the ones that removed a merchant's text.
// The base is readable with the capability; a merchant's layer within the operator's scope over it.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../../src/composition/graph/index.js";
import { ClockPort } from "../../../src/composition/modules/shared-kernel.js";
import { json } from "../../helpers/json.js";
import {
  admin,
  fixedClock,
  sharedTestApp,
  type MerchantSpec,
  type SharedApp,
} from "../../helpers/test-app.js";
import type { components } from "#generated/api.js";

type TextVersionDto = components["schemas"]["TextVersion"];
type TextVersionPage = components["schemas"]["TextVersionPage"];

const NOW = "2026-10-04T12:00:00.000Z";
const FAMILY = "fit.variant_selector.information";
const SPOKEN = "fit.variant_selector.uncertainty";

const merchant = (id: "a" | "b"): MerchantSpec => ({
  merchantId: `m_${id}`,
  ingestKeys: [`key-${id}-1`],
  platformKeys: [`platform-${id}-1`],
  origins: [`https://${id}.example`],
  experiments: [],
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
});

const publishBase = (body: Record<string, unknown>) =>
  admin(app.app, "POST", "/v1/admin/texts", { body: { family: FAMILY, locale: "es", ...body } });
const publishOwn = (id: "a" | "b", body: Record<string, unknown>) =>
  admin(app.app, "POST", `/v1/admin/merchants/m_${id}/texts`, {
    body: { family: FAMILY, locale: "es", ...body },
  });
const read = (path: string, as?: "ops-a") => admin(app.app, "GET", path, as === undefined ? {} : { as });

describe("the history of a key (US5)", () => {
  it("lists the versions of a base key newest first, from the seed on, and reads one by its number", async () => {
    expect((await publishBase({ text: "Second wording." })).statusCode).toBe(201);
    expect((await publishBase({ text: "Third wording." })).statusCode).toBe(201);
    const page = json(await read(`/v1/admin/texts/${FAMILY}/es/versions`)) as TextVersionPage;
    expect(page.items.map((v) => [v.version, v.text])).toEqual([
      [3, "Third wording."],
      [2, "Second wording."],
      [1, page.items[2]?.text],
    ]);
    expect(page.items[2]).toMatchObject({ layer: "base", operatorId: "system", removed: false });
    const second = json(await read(`/v1/admin/texts/${FAMILY}/es/versions/2`)) as TextVersionDto;
    expect(second).toMatchObject({
      version: 2,
      text: "Second wording.",
      messageVersionId: `base/${FAMILY}/-/es#2`,
    });
    // Paginated: the first page carries the cursor of the next.
    const first = json(await read(`/v1/admin/texts/${FAMILY}/es/versions?limit=2`)) as TextVersionPage;
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBeDefined();
    const rest = json(
      await read(`/v1/admin/texts/${FAMILY}/es/versions?limit=2&cursor=${first.nextCursor ?? ""}`),
    ) as TextVersionPage;
    expect(rest.items.map((v) => v.version)).toEqual([1]);
  });

  it("a number the key does not have is not found, and so is a key without any version [invariant:text-version-not-found]", async () => {
    const missing = await read(`/v1/admin/texts/${FAMILY}/es/versions/7`);
    expect(missing.statusCode).toBe(404);
    expect((json(missing) as { type: string }).type).toBe("urn:ope:problem:text-version-not-found");
    const never = json(await read(`/v1/admin/texts/${FAMILY}/pt-BR/versions`)) as TextVersionPage;
    expect(never.items).toEqual([]);
  });

  it("a key that speaks of an attribute is read with its value as a query parameter", async () => {
    expect(
      (await publishBase({ family: SPOKEN, attributeValue: "linen", text: "Linen, reworded." })).statusCode,
    ).toBe(201);
    const linen = json(
      await read(`/v1/admin/texts/${SPOKEN}/es/versions?attributeValue=linen`),
    ) as TextVersionPage;
    expect(linen.items.map((v) => [v.version, v.attributeValue])).toEqual([
      [2, "linen"],
      [1, "linen"],
    ]);
    const denim = json(
      await read(`/v1/admin/texts/${SPOKEN}/es/versions?attributeValue=denim`),
    ) as TextVersionPage;
    expect(denim.items.map((v) => v.version)).toEqual([1]);
  });

  it("a merchant's history keeps the version that removed its text, and is read only within the operator's scope", async () => {
    expect((await publishOwn("a", { text: "A's words." })).statusCode).toBe(201);
    expect((await publishOwn("a", { remove: true })).statusCode).toBe(201);
    const page = json(
      await read(`/v1/admin/merchants/m_a/texts/${FAMILY}/es/versions`, "ops-a"),
    ) as TextVersionPage;
    expect(page.items.map((v) => [v.version, v.removed, v.text])).toEqual([
      [2, true, undefined],
      [1, false, "A's words."],
    ]);
    const removal = json(
      await read(`/v1/admin/merchants/m_a/texts/${FAMILY}/es/versions/2`, "ops-a"),
    ) as TextVersionDto;
    expect(removal).toMatchObject({
      layer: "m_a",
      version: 2,
      removed: true,
      messageVersionId: `m_a/${FAMILY}/-/es#2`,
    });
    // B's layer is B's: the operator over A reads nothing of it, and B's own history is empty anyway.
    expect((await read(`/v1/admin/merchants/m_b/texts/${FAMILY}/es/versions`, "ops-a")).statusCode).toBe(403);
    const ofB = json(await read(`/v1/admin/merchants/m_b/texts/${FAMILY}/es/versions`)) as TextVersionPage;
    expect(ofB.items).toEqual([]);
    expect((await read(`/v1/admin/merchants/m_b/texts/${FAMILY}/es/versions/1`)).statusCode).toBe(404);
  });
});

describe("what a text version restarted, in every reading (feature 042)", () => {
  /** Opens and activates an experiment of the merchant through the API, and answers its identifier. */
  async function running(id: "a" | "b"): Promise<string> {
    const opened = await admin(app.app, "POST", `/v1/admin/merchants/m_${id}/experiments`, {
      body: { treatmentShare: 0.5, seed: `seed-${id}`, targetSample: 1000, cuts: [0.5, 1] },
    });
    expect(opened.statusCode).toBe(201);
    const { experimentId } = json(opened) as { experimentId: string };
    const url = `/v1/admin/merchants/m_${id}/experiments/${experimentId}`;
    expect((await admin(app.app, "POST", `${url}/activate`)).statusCode).toBe(200);
    return experimentId;
  }

  const close = async (id: "a" | "b", experimentId: string) => {
    expect(
      (await admin(app.app, "POST", `/v1/admin/merchants/m_${id}/experiments/${experimentId}/close`))
        .statusCode,
    ).toBe(200);
  };

  const corrective = { corrective: true, reason: "the wording was wrong" };

  it("a base text: the publication, its repetition, the history and the version by number say the same", async () => {
    const reached = [await running("a"), await running("b")].sort();
    const body = { text: "Second wording.", ...corrective };
    const published = await publishBase(body);
    expect(published.statusCode).toBe(201);
    const listOf = (dto: unknown) => [...((dto as TextVersionDto).windowsRestarted ?? [])].sort();
    expect(listOf(json(published))).toEqual(reached);

    const page = json(await read(`/v1/admin/texts/${FAMILY}/es/versions`)) as TextVersionPage;
    expect(listOf(page.items[0])).toEqual(reached);
    expect(page.items[1]).not.toHaveProperty("windowsRestarted");
    expect(listOf(json(await read(`/v1/admin/texts/${FAMILY}/es/versions/2`)))).toEqual(reached);

    const repeated = await publishBase(body);
    expect(repeated.statusCode).toBe(200);
    expect(listOf(json(repeated))).toEqual(reached);
  });

  it("another key with the same number answers for itself, not for the version that restarted", async () => {
    const experiment = await running("a");
    expect((await publishBase({ text: "Second wording.", ...corrective })).statusCode).toBe(201);
    await close("a", experiment);
    // Version 2 of another key in the same layer, published with nothing running: it restarted nothing.
    expect(
      (await publishBase({ family: SPOKEN, attributeValue: "linen", text: "Linen, reworded." })).statusCode,
    ).toBe(201);

    const linen = json(
      await read(`/v1/admin/texts/${SPOKEN}/es/versions/2?attributeValue=linen`),
    ) as TextVersionDto;
    expect(linen).not.toHaveProperty("windowsRestarted");
    // And the closed experiment stays named by the version that restarted it.
    expect(json(await read(`/v1/admin/texts/${FAMILY}/es/versions/2`))).toMatchObject({
      windowsRestarted: [experiment],
    });
  });

  it("a merchant's text names its merchant's experiment, never another merchant's version of the same number", async () => {
    const ofA = await running("a");
    const ofB = await running("b");
    expect((await publishOwn("a", { text: "A's words.", ...corrective })).statusCode).toBe(201);
    expect((await publishOwn("b", { text: "B's words.", ...corrective })).statusCode).toBe(201);

    const page = json(await read(`/v1/admin/merchants/m_a/texts/${FAMILY}/es/versions`)) as TextVersionPage;
    expect(page.items[0]).toMatchObject({ version: 1, windowsRestarted: [ofA] });
    expect(json(await read(`/v1/admin/merchants/m_b/texts/${FAMILY}/es/versions/1`))).toMatchObject({
      windowsRestarted: [ofB],
    });
  });
});
