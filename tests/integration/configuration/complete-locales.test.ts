// A language is not supported without texts (feature 038, US4; FR-010, FR-011), over HTTP and end to end:
// the two publications that declare languages — the treatment defaults and a merchant's own configuration —
// refuse a language that enters without a complete base, naming the families, and accept it once the base
// was completed by the API. Removing a language asks nothing.
//
// The seed supports Spanish only, with Spanish as the reserve, and the base holds Spanish only.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../../src/composition/graph/index.js";
import { ClockPort } from "../../../src/composition/modules/shared-kernel.js";
import { TextKey } from "../../../src/domain/messages/index.js";
import { json } from "../../helpers/json.js";
import { admin, fixedClock, startTestApp } from "../../helpers/test-app.js";
import type { App } from "../../../src/composition/bootstrap.js";

let app: App;
beforeEach(async () => {
  app = await startTestApp({ ports: [replace(ClockPort, fixedClock())] });
});
afterEach(async () => {
  await app.close();
});

const PROBLEM = "urn:ope:problem:locale-incomplete";

/** The defaults in force, as a body: the version name is minted, not sent. */
async function defaults(): Promise<Record<string, unknown>> {
  const { version, ...content } = json(await admin(app.app, "GET", "/v1/admin/treatment-defaults")) as Record<
    string,
    unknown
  >;
  expect(version).toBe("defaults-1");
  return content;
}

const publishDefaults = (content: Record<string, unknown>) =>
  admin(app.app, "POST", "/v1/admin/treatment-defaults", {
    body: { content, corrective: true, reason: "languages" },
  });

const declare = (declared: Record<string, unknown>) =>
  admin(app.app, "POST", "/v1/admin/merchants/m_a/configuration", {
    body: { declared, corrective: true, reason: "languages" },
  });

/** Every family the base has to hold in a language, published for `locale`. */
async function completeBase(locale: string): Promise<void> {
  for (const family of TextKey.unconditionalFamilies()) {
    const res = await admin(app.app, "POST", "/v1/admin/texts", {
      body: { family, locale, text: `${family}, in ${locale}.`, corrective: true, reason: "completing" },
    });
    expect(res.statusCode, family).toBe(201);
  }
}

describe("a language without texts (US4)", () => {
  it("the defaults refuse a language that enters without a complete base, naming every missing family where it was declared [invariant:locale-incomplete]", async () => {
    const content = await defaults();
    const refused = await publishDefaults({
      ...content,
      locales: { supported: ["es", "pt-BR"], fallback: "es" },
    });
    expect(refused.statusCode).toBe(422);
    const problem = json(refused) as { type: string; errors: { pointer: string; message: string }[] };
    expect(problem.type).toBe(PROBLEM);
    expect(problem.errors[0]?.pointer).toBe("/content/locales/supported/1");
    expect(problem.errors[0]?.message).toBe(`pt-BR: ${[...TextKey.unconditionalFamilies()].join(", ")}`);
    expect(json(await admin(app.app, "GET", "/v1/admin/treatment-defaults"))).toMatchObject({
      version: "defaults-1",
    });
  });

  it("completed by the API, the same language is accepted; and removing a language asks nothing", async () => {
    const content = await defaults();
    await completeBase("pt-BR");
    const accepted = await publishDefaults({
      ...content,
      locales: { supported: ["es", "pt-BR"], fallback: "es" },
    });
    expect(accepted.statusCode).toBe(201);
    // A language that is there is not judged again, and one that leaves needs no texts: back to Spanish only.
    const removed = await publishDefaults({ ...content, locales: { supported: ["es"], fallback: "es" } });
    expect(removed.statusCode).toBe(201);
    expect(json(removed)).toMatchObject({ version: 3 });
  });

  it("a merchant that declares a language of its own is judged the same way, under its own field", async () => {
    const refused = await declare({ locales: { supported: ["es", "en"], fallback: "es" } });
    expect(refused.statusCode).toBe(422);
    expect(json(refused)).toMatchObject({
      type: PROBLEM,
      errors: [{ pointer: "/declared/locales/supported/1" }],
    });
    await completeBase("en");
    expect((await declare({ locales: { supported: ["es", "en"], fallback: "es" } })).statusCode).toBe(201);
    // Declaring something else leaves the languages alone, so nothing is asked of the base.
    expect((await declare({ holdoutShare: 0.1 })).statusCode).toBe(201);
  });
});
