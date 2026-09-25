// A curated text only exists valid: if you hold one, it can be shown to a person. The four
// rejections are the whole contract of the corpus, and the last one is the only mechanical defence
// against a template reaching a reader with its slot still in it (03 §4.4).
import { describe, expect, it } from "vitest";
import { CuratedText, messageVersion } from "../../../../src/domain/messages/index.js";

const version = messageVersion("mv_fit_policies_reassurance_es_neutral_1");
// The texts here are fixtures, not corpus content: what is judged is the shape of a text, never
// what it says, so they stay in the language of the code (ADR-015).
const of = (value: string) => CuratedText.of(version, value);

describe("CuratedText.of", () => {
  it("keeps the text trimmed and remembers its version", () => {
    const text = of("  If it does not fit, the exchange is free.  ");
    expect(text.ok && text.value.value).toBe("If it does not fit, the exchange is free.");
    expect(text.ok && text.value.version).toBe(version);
  });

  it("refuses an empty text, and whitespace is empty", () => {
    for (const value of ["", "   ", "\n\t "]) {
      const text = of(value);
      expect(text.ok, value).toBe(false);
      expect(!text.ok && text.error.code).toBe("corpus-text-empty");
    }
  });

  it("refuses a text longer than the contract publishes, and accepts one exactly at the limit", () => {
    const limit = "a".repeat(512);
    expect(of(limit).ok).toBe(true);
    const over = of(`${limit}a`);
    expect(over.ok).toBe(false);
    expect(!over.ok && over.error.code).toBe("corpus-text-too-long");
  });

  it("every rejection names the version, and the long one says how long: a corpus of many texts is fixed by knowing which", () => {
    // Without the version in the details, the startup refusal says a text is wrong and not which
    // one, which in a corpus is the difference between a fix and a search.
    const empty = of("");
    expect(!empty.ok && empty.error.details).toEqual({ version });
    const over = of("a".repeat(513));
    expect(!over.ok && over.error.details).toEqual({ version, length: 513 });
    const template = of("Fabric {material}.");
    expect(!template.ok && template.error.details).toEqual({ version });
  });

  it("refuses a text that still carries a slot: the corpus takes prose, never a template", () => {
    for (const value of ["Fabric is {material}.", "{0} left in your size", "Before the {"]) {
      const text = of(value);
      // The last one has no closing brace and is prose: only a closed slot is a template.
      expect(text.ok, value).toBe(value === "Before the {");
    }
    const template = of("Fabric {material}, drape {drape}.");
    expect(!template.ok && template.error.code).toBe("corpus-text-has-placeholder");
  });
});
