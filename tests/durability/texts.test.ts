// The texts across a restart (feature 038). **This suite is the only cover the durable text store has
// against a real store** (feature 030, research R-06): the unit test with the double fixes the rule of the
// index, and this one fixes what only shows up by shutting down and starting again.
//
// - **The number of the next version comes from the table**, per layer and key: a counter in the gateway
//   would number the first version of the second boot as 1 and overwrite a history meant to be immutable.
// - **The two layers are numbered apart**, and so is every key: a query that forgot its layer would mix the
//   base with a merchant's, and a merchant would quote a version nobody published for it.
// - **What is in force is rebuilt from the table at boot**, removals included: a merchant that went back to
//   the base before the restart is still on the base after it.
// - **Nothing crosses merchants**, before or after the restart.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { asOperatorId } from "../../src/domain/operator/index.js";
import { asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { sqliteTextStore } from "../../src/interface-adapters/messages/index.js";
import { restartableStore, type Restartable } from "./store-fixture.js";
import type { TextDraft } from "../../src/domain/messages/index.js";

const NOW = new Date("2026-10-04T10:00:00.000Z");
const KEY = { family: "fit.variant_selector.information", locale: "es" };
const UNO = asMerchantId("m_uno");
const DOS = asMerchantId("m_dos");

let fixture: Restartable;

beforeEach(() => {
  fixture = restartableStore();
});

afterEach(() => {
  fixture.dispose();
});

/** A store over the current connection. After `restart()` this is a different one over the same file. */
const texts = () => sqliteTextStore({ store: fixture.store, logger: fixture.logger });

const draft = (over: Partial<TextDraft> = {}): TextDraft => ({
  key: KEY,
  text: "Base.",
  corrective: false,
  publishedAt: NOW,
  operatorId: asOperatorId("op_ana"),
  ...over,
});

const removal = (over: Partial<TextDraft> = {}): TextDraft =>
  Object.fromEntries(Object.entries(draft(over)).filter(([field]) => field !== "text")) as TextDraft;

const published = async (store: ReturnType<typeof texts>, input: TextDraft) => {
  const result = await store.publish(input);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
};

describe("the texts across a restart", () => {
  it("starts on an empty store, and an empty store is a valid store", async () => {
    expect(await texts().isEmpty()).toBe(true);
    expect(await texts().baseKeys()).toEqual([]);
  });

  it("serves after the restart what was published before it, in both layers, and numbers from the table", async () => {
    const before = texts();
    await published(before, draft());
    await published(before, draft({ text: "Base, corrected." }));
    await published(before, draft({ merchantId: UNO, text: "Own text." }));

    fixture.restart();

    const after = texts();
    expect((await after.find(UNO, KEY))?.value).toBe("Own text.");
    expect((await after.find(DOS, KEY))?.value).toBe("Base, corrected.");
    expect((await after.find(UNO, KEY))?.version).toBe(`m_uno/${KEY.family}/-/es#1`);
    // The next number comes from the table, per layer and key: a counter would say 1 again.
    const third = await published(after, draft({ text: "Base, third." }));
    expect(third.version).toBe(3);
    const second = await published(after, draft({ merchantId: UNO, text: "Own text, second." }));
    expect(second.version).toBe(2);
  });

  it("keeps a removal across the restart: the merchant stays on the base", async () => {
    const before = texts();
    await published(before, draft());
    await published(before, draft({ merchantId: UNO, text: "Own text." }));
    await published(before, removal({ merchantId: UNO }));

    fixture.restart();

    const after = texts();
    expect((await after.find(UNO, KEY))?.value).toBe("Base.");
    expect((await after.inForce(UNO, KEY))?.isRemoved()).toBe(true);
    expect((await after.inForce(UNO, KEY))?.version).toBe(2);
    expect(await after.baseKeys()).toEqual([KEY]);
  });

  it("reads the history of a key newest first, with its instants, and one version by its number", async () => {
    const before = texts();
    await published(before, draft());
    await published(before, draft({ text: "Base, corrected.", corrective: true, reason: "a typo" }));

    fixture.restart();

    const after = texts();
    const page = await after.versionsOf(undefined, KEY, { limit: 1 });
    expect(page.items.map((v) => v.version)).toEqual([2]);
    expect(page.items[0]?.reason).toBe("a typo");
    expect(page.items[0]?.publishedAt).toBeInstanceOf(Date);
    expect(page.nextCursor).toBeDefined();
    const rest = await after.versionsOf(undefined, KEY, { limit: 1, cursor: page.nextCursor });
    expect(rest.items.map((v) => v.version)).toEqual([1]);
    expect(rest).not.toHaveProperty("nextCursor");
    expect((await after.versionOf(undefined, KEY, 1))?.text?.value).toBe("Base.");
    expect(await after.versionOf(undefined, KEY, 9)).toBeUndefined();
  });

  it("shows a merchant nothing of another one, after the restart too", async () => {
    const before = texts();
    await published(before, draft());
    await published(before, draft({ merchantId: UNO, text: "Own text of one." }));

    fixture.restart();

    const after = texts();
    expect((await after.find(DOS, KEY))?.value).toBe("Base.");
    expect(await after.inForce(DOS, KEY)).toBeUndefined();
    expect((await after.versionsOf(DOS, KEY, { limit: 10 })).items).toEqual([]);
  });

  it("degrades to the port's failure channel when the store refuses, and the index stays as it was", async () => {
    const store = texts();
    await published(store, draft());
    fixture.makeUnavailable();
    const refused = await store.publish(draft({ merchantId: UNO, text: "Own text." }));
    expect(refused.ok).toBe(false);
    expect(refused.ok ? undefined : refused.error.code).toBe("store-unavailable");
    expect((await store.find(UNO, KEY))?.value).toBe("Base.");
    expect(fixture.logged.map((entry) => entry.fields["write"])).toEqual(["text"]);
  });
});
