// Feature 038 (FR-002, FR-003, FR-004, FR-006, FR-012): a version of a text is numbered by the store,
// immutable, corrective only with its reason, and only a merchant's layer may say «removed». Its
// identifier is minted from layer, key and number, and never carries a voice.
import { describe, expect, it } from "vitest";
import {
  TextVersion,
  type TextDraft,
  type TextVersionRecord,
} from "../../../../src/domain/messages/index.js";
import { asOperatorId } from "../../../../src/domain/operator/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";

const AT = new Date("2026-10-04T12:00:00.000Z");
const FAMILY = "fit.variant_selector.information";

const draft = (over: Partial<TextDraft> = {}): TextDraft => ({
  key: { family: FAMILY, locale: "es" },
  text: "Size may vary between brands.",
  corrective: false,
  publishedAt: AT,
  operatorId: asOperatorId("ops-all"),
  ...over,
});

/** A draft that removes: the same draft without its text, which is what a removal is. */
const removal = (over: Partial<TextDraft> = {}): TextDraft =>
  Object.fromEntries(Object.entries(draft(over)).filter(([field]) => field !== "text")) as TextDraft;

const code = (result: ReturnType<typeof TextVersion.draft>): string | undefined =>
  result.ok ? undefined : result.error.code;

describe("TextVersion.draft", () => {
  it("accepts a base text for a key of the vocabulary, trimmed", () => {
    const judged = TextVersion.draft(draft({ text: "  With spaces.  " }));
    expect(judged.ok).toBe(true);
    expect(judged.ok ? judged.value.text : undefined).toBe("With spaces.");
  });

  it("refuses a key outside the vocabulary before looking at the text", () => {
    expect(code(TextVersion.draft(draft({ key: { family: "no.such.family", locale: "es" } })))).toBe(
      "text-key-unknown",
    );
  });

  it("refuses an empty text, a text longer than the contract allows, and one with a placeholder", () => {
    expect(code(TextVersion.draft(draft({ text: "   " })))).toBe("corpus-text-empty");
    expect(code(TextVersion.draft(draft({ text: "x".repeat(513) })))).toBe("corpus-text-too-long");
    expect(code(TextVersion.draft(draft({ text: "Size {size} may vary." })))).toBe(
      "corpus-text-has-placeholder",
    );
  });

  it("refuses a corrective draft without a reason, and one with a blank one", () => {
    expect(code(TextVersion.draft(draft({ corrective: true })))).toBe("configuration-reason-required");
    expect(code(TextVersion.draft(draft({ corrective: true, reason: " " })))).toBe(
      "configuration-reason-required",
    );
    expect(TextVersion.draft(draft({ corrective: true, reason: "A typo reached the store." })).ok).toBe(true);
  });

  it("lets a merchant's layer remove its text, and refuses that in the base", () => {
    const removed = TextVersion.draft(removal({ merchantId: asMerchantId("m_uno") }));
    expect(removed.ok).toBe(true);
    expect(code(TextVersion.draft(removal()))).toBe("base-text-required");
  });
});

describe("TextVersion, numbered", () => {
  it("mints its identifier from layer, key and number, without any voice", () => {
    const base = TextVersion.numbered(draft(), 3);
    expect(base.messageVersionId()).toBe(`base/${FAMILY}/-/es#3`);
    expect(base.text?.version).toBe(base.messageVersionId());
    const own = TextVersion.numbered(draft({ merchantId: asMerchantId("m_uno") }), 1);
    expect(own.messageVersionId()).toBe(`m_uno/${FAMILY}/-/es#1`);
    expect(own.isRemoved()).toBe(false);
  });

  it("a removal has no text and says so", () => {
    const removed = TextVersion.numbered(removal({ merchantId: asMerchantId("m_uno") }), 2);
    expect(removed.isRemoved()).toBe(true);
    expect(removed.text).toBeUndefined();
    expect(removed.record().text).toBeUndefined();
  });

  it("repeats an identical text, and not one that differs in a word, in the flag or in the reason", () => {
    const current = TextVersion.numbered(draft(), 1);
    expect(current.sameTextAs(draft())).toBe(true);
    expect(current.sameTextAs(draft({ text: " Size may vary between brands. " }))).toBe(true);
    expect(current.sameTextAs(draft({ text: "Size may vary." }))).toBe(false);
    // The flag and the reason count on their own: the same words published as corrective, or with another
    // reason, is a corrective version with consequences of its own, not a repetition.
    expect(current.sameTextAs(draft({ corrective: true }))).toBe(false);
    expect(current.sameTextAs(draft({ reason: "r" }))).toBe(false);
    const removed = TextVersion.numbered(removal({ merchantId: asMerchantId("m_uno") }), 2);
    expect(removed.sameTextAs(removal({ merchantId: asMerchantId("m_uno") }))).toBe(true);
    expect(removed.sameTextAs(draft({ merchantId: asMerchantId("m_uno") }))).toBe(false);
  });

  it("rehydrates from a plain record, turning the text into a curated text with its identifier (feature 037)", () => {
    const record: TextVersionRecord = {
      key: { family: FAMILY, locale: "es" },
      merchantId: asMerchantId("m_uno"),
      version: 4,
      text: "Own text.",
      corrective: true,
      reason: "A typo reached the store.",
      publishedAt: AT,
      operatorId: asOperatorId("ops-uno"),
    };
    const version = TextVersion.rehydrate(record);
    expect(version.record()).toEqual(record);
    expect(version.text?.value).toBe("Own text.");
    expect(version.text?.version).toBe(`m_uno/${FAMILY}/-/es#4`);
    expect(version.key.locale).toBe("es");
  });
});
