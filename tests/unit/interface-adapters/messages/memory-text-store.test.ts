// Feature 038: the in-memory text store numbers versions per key and layer, keeps every one, and answers the
// corpus from what is in force — the merchant's layer before the base, inside one language.
import { describe, expect, it } from "vitest";
import { asOperatorId } from "../../../../src/domain/operator/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";
import { memoryTextStore } from "../../../../src/interface-adapters/messages/index.js";
import type { TextDraft } from "../../../../src/domain/messages/index.js";

const AT = new Date("2026-10-04T12:00:00.000Z");
const KEY = { family: "fit.variant_selector.information", locale: "es" };
const UNO = asMerchantId("m_uno");
const DOS = asMerchantId("m_dos");

const draft = (over: Partial<TextDraft> = {}): TextDraft => ({
  key: KEY,
  text: "Base.",
  corrective: false,
  publishedAt: AT,
  operatorId: asOperatorId("ops"),
  ...over,
});

const removal = (over: Partial<TextDraft> = {}): TextDraft =>
  Object.fromEntries(Object.entries(draft(over)).filter(([field]) => field !== "text")) as TextDraft;

const published = async (store: ReturnType<typeof memoryTextStore>, input: TextDraft) => {
  const result = await store.publish(input);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
};

describe("memoryTextStore", () => {
  it("numbers versions per key and layer, from one, and keeps every one", async () => {
    const store = memoryTextStore();
    expect(await store.isEmpty()).toBe(true);
    const first = await published(store, draft());
    const second = await published(store, draft({ text: "Base, corrected." }));
    const own = await published(store, draft({ merchantId: UNO, text: "Own text." }));
    expect([first.version, second.version, own.version]).toEqual([1, 2, 1]);
    expect(await store.isEmpty()).toBe(false);
    expect((await store.versionsOf(undefined, KEY, { limit: 10 })).items.map((v) => v.version)).toEqual([
      2, 1,
    ]);
    expect((await store.versionOf(undefined, KEY, 1))?.text?.value).toBe("Base.");
    expect(await store.versionOf(undefined, KEY, 3)).toBeUndefined();
  });

  it("answers the merchant's text before the base, and the base to everybody else", async () => {
    const store = memoryTextStore();
    await published(store, draft());
    await published(store, draft({ merchantId: UNO, text: "Own text." }));
    expect((await store.find(UNO, KEY))?.value).toBe("Own text.");
    expect((await store.find(DOS, KEY))?.value).toBe("Base.");
    expect(await store.find(UNO, { ...KEY, locale: "en" })).toBeUndefined();
  });

  it("a removal is a version that sends the key back to the base", async () => {
    const store = memoryTextStore();
    await published(store, draft());
    await published(store, draft({ merchantId: UNO, text: "Own text." }));
    const removed = await published(store, removal({ merchantId: UNO }));
    expect(removed.isRemoved()).toBe(true);
    expect(removed.version).toBe(2);
    expect((await store.find(UNO, KEY))?.value).toBe("Base.");
    expect((await store.inForce(UNO, KEY))?.isRemoved()).toBe(true);
    expect(await store.inForce(DOS, KEY)).toBeUndefined();
  });

  it("names the keys the base holds a text for, and not the ones a merchant holds", async () => {
    const store = memoryTextStore();
    await published(store, draft());
    await published(store, draft({ key: { ...KEY, locale: "en" }, text: "Base." }));
    await published(store, draft({ merchantId: UNO, key: { ...KEY, locale: "pt" }, text: "Own text, pt." }));
    expect(await store.baseKeys()).toEqual([KEY, { ...KEY, locale: "en" }]);
  });
});
