// Feature 027 — US2: the corpus is keyed by family, attribute value, language and voice, and the
// attribute value is **part of the key**. Two texts of the same family that differ only in the value
// are two texts: if the key collapsed them, every fabric would say the same thing.
import { describe, expect, it } from "vitest";
import { CuratedText, messageVersion } from "../../../../src/domain/messages/index.js";
import { memoryMessageCorpus, type CorpusEntry } from "../../../../src/interface-adapters/messages/index.js";
import type { TextKey } from "../../../../src/application/messages/index.js";

const FAMILY = "fit.variant_selector.uncertainty";
const entry = (value: string, over: Partial<TextKey> = {}): CorpusEntry => {
  const version = messageVersion(`mv_${over.attributeValue ?? "base"}_es_neutral_1`);
  const text = CuratedText.of(version, value);
  if (!text.ok) throw new Error(text.error.message);
  return { key: { family: FAMILY, locale: "es", voice: "neutral", ...over }, text: text.value };
};

const corpus = memoryMessageCorpus([
  entry("The sentence with no fabric."),
  entry("The linen sentence.", { attributeValue: "linen" }),
  entry("The denim sentence.", { attributeValue: "denim" }),
  entry("The sentence in the other language.", { locale: "en" }),
]);
const find = async (over: Partial<TextKey> = {}) =>
  (await corpus.find({ family: FAMILY, locale: "es", voice: "neutral", ...over }))?.value;

describe("memoryMessageCorpus", () => {
  it("the attribute value is part of the key: each value gets its own text, and none is the other's", async () => {
    expect(await find({ attributeValue: "linen" })).toBe("The linen sentence.");
    expect(await find({ attributeValue: "denim" })).toBe("The denim sentence.");
    expect(await find()).toBe("The sentence with no fabric.");
  });

  it("the language is part of the key too, and a key nobody wrote for answers nothing", async () => {
    expect(await find({ locale: "en" })).toBe("The sentence in the other language.");
    expect(await find({ locale: "pt" })).toBeUndefined();
    expect(await find({ attributeValue: "leather" })).toBeUndefined();
    expect(await find({ family: "price.price.evidence" })).toBeUndefined();
  });
});
