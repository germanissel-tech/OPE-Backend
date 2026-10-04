// Feature 038 (FR-017): the base is complete in a language when every family that does not depend on the
// product has a text in it; a family that speaks of an attribute does not count (01 §322).
import { describe, expect, it } from "vitest";
import { BaseTexts, TextKey } from "../../../../src/domain/messages/index.js";

const unconditional = TextKey.unconditionalFamilies();
const WITH_ATTRIBUTE = "fit.variant_selector.uncertainty";

describe("BaseTexts.missingFor", () => {
  it("a base with every unconditional family in a language is complete in it, and in no other", () => {
    const base = BaseTexts.of(unconditional.map((family) => ({ family, locale: "es" })));
    expect(base.missingFor("es")).toEqual([]);
    expect(base.missingFor("en")).toEqual(unconditional);
  });

  it("names the families that are missing, in the order of the vocabulary", () => {
    const [first, ...rest] = unconditional;
    const base = BaseTexts.of(rest.map((family) => ({ family, locale: "es" })));
    expect(base.missingFor("es")).toEqual([first]);
  });

  it("a family that speaks of the product does not count, with or without texts", () => {
    expect(unconditional).not.toContain(WITH_ATTRIBUTE);
    const base = BaseTexts.of([
      ...unconditional.map((family) => ({ family, locale: "es" })),
      { family: WITH_ATTRIBUTE, attributeValue: "linen", locale: "en" },
    ]);
    expect(base.missingFor("es")).toEqual([]);
    expect(base.missingFor("en")).toEqual(unconditional);
  });

  it("an empty base lacks everything, everywhere", () => {
    expect(BaseTexts.of([]).missingFor("es")).toEqual(unconditional);
  });
});
