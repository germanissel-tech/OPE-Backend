// Feature 038 (FR-005): a text key is judged against OPE's vocabularies and never created by the API.
// Family and attribute value are closed; the language is a tag by shape; and a value goes only with a
// family that speaks of the product.
import { describe, expect, it } from "vitest";
import { TextKey } from "../../../../src/domain/messages/index.js";

const UNCONDITIONAL = "fit.variant_selector.information";
const WITH_ATTRIBUTE = "fit.variant_selector.uncertainty";

const part = (result: ReturnType<typeof TextKey.of>): string | undefined =>
  result.ok ? undefined : String(result.error.details["part"]);

describe("TextKey.of", () => {
  it("accepts a family the plane can choose, in a language by shape", () => {
    const key = TextKey.of({ family: UNCONDITIONAL, locale: "es-AR" });
    expect(key.ok).toBe(true);
    if (!key.ok) return;
    expect(key.value.family).toBe(UNCONDITIONAL);
    expect(key.value.attributeValue).toBeUndefined();
    expect(key.value.locale).toBe("es-AR");
  });

  it("accepts a family that speaks of the product with a value of OPE's vocabulary", () => {
    const key = TextKey.of({ family: WITH_ATTRIBUTE, attributeValue: "linen", locale: "es" });
    expect(key.ok).toBe(true);
    expect(key.ok ? key.value.attributeValue : undefined).toBe("linen");
  });

  it("refuses a family the plane cannot choose, naming the part", () => {
    const key = TextKey.of({ family: "fit.variant_selector.typo", locale: "es" });
    expect(key.ok).toBe(false);
    expect(part(key)).toBe("family");
    expect(key.ok ? undefined : key.error.code).toBe("text-key-unknown");
  });

  it("refuses a value OPE writes no texts for", () => {
    expect(part(TextKey.of({ family: WITH_ATTRIBUTE, attributeValue: "silk", locale: "es" }))).toBe(
      "attributeValue",
    );
  });

  it("refuses a value on a family that says nothing of the product, and demands one where it does", () => {
    expect(part(TextKey.of({ family: UNCONDITIONAL, attributeValue: "linen", locale: "es" }))).toBe(
      "attributeValue",
    );
    expect(part(TextKey.of({ family: WITH_ATTRIBUTE, locale: "es" }))).toBe("attributeValue");
  });

  it("refuses a language that is not a tag by shape", () => {
    expect(part(TextKey.of({ family: UNCONDITIONAL, locale: "not a tag" }))).toBe("locale");
    expect(part(TextKey.of({ family: UNCONDITIONAL, locale: "" }))).toBe("locale");
  });

  it("rehydrates without judging, and says the same thing in its record", () => {
    const record = { family: UNCONDITIONAL, locale: "es" };
    const key = TextKey.rehydrate(record);
    expect(key.record()).toEqual(record);
    expect(key.equals(TextKey.rehydrate({ family: UNCONDITIONAL, locale: "es" }))).toBe(true);
    expect(key.equals(TextKey.rehydrate({ family: UNCONDITIONAL, locale: "en" }))).toBe(false);
    expect(
      key.equals(TextKey.rehydrate({ family: WITH_ATTRIBUTE, attributeValue: "linen", locale: "es" })),
    ).toBe(false);
  });

  it("names itself the same way wherever a text is quoted", () => {
    expect(TextKey.rehydrate({ family: UNCONDITIONAL, locale: "es" }).toString()).toBe(
      `${UNCONDITIONAL}/-/es`,
    );
    expect(
      TextKey.rehydrate({ family: WITH_ATTRIBUTE, attributeValue: "linen", locale: "es" }).toString(),
    ).toBe(`${WITH_ATTRIBUTE}/linen/es`);
  });
});
