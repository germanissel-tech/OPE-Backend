// What a merchant's own labels correspond to in OPE's vocabulary (feature 027). The whole point is
// that the merchant's label is never shown: it is free text the platform exposes without
// normalisation, so it either corresponds to something OPE wrote about or the product says nothing.
import { describe, expect, it } from "vitest";
import { AttributeLabels } from "../../../../src/domain/messages/index.js";

describe("AttributeLabels.of", () => {
  it("several labels may mean one value: three stores, one sentence", () => {
    const labels = AttributeLabels.of([
      { label: "Combed Cotton 24/1", value: "combed-cotton" },
      { label: "peinado", value: "combed-cotton" },
      { label: "COMBED COTTON", value: "combed-cotton" },
    ]);
    expect(labels.ok).toBe(true);
    if (!labels.ok) return;
    for (const label of ["Combed Cotton 24/1", "peinado", "COMBED COTTON"]) {
      expect(labels.value.valueOf(label)).toBe("combed-cotton");
    }
  });

  it("[invariant:duplicate-attribute-label] one label pointing at two values is refused, naming it", () => {
    const labels = AttributeLabels.of([
      { label: "jersey", value: "jersey" },
      { label: "jersey", value: "combed-cotton" },
    ]);
    expect(labels.ok).toBe(false);
    if (labels.ok) return;
    expect(labels.error.code).toBe("duplicate-attribute-label");
    expect(labels.error.details).toMatchObject({ label: "jersey" });
  });

  it("refuses a value OPE writes no texts for, naming it", () => {
    const labels = AttributeLabels.of([{ label: "Lycra", value: "elastane" }]);
    expect(labels.ok).toBe(false);
    if (labels.ok) return;
    expect(labels.error.code).toBe("unknown-attribute-value");
    expect(labels.error.details).toMatchObject({ value: "elastane" });
  });

  it("a label nobody mapped means nothing, and a merchant that declared nothing says nothing", () => {
    const labels = AttributeLabels.of([{ label: "linen", value: "linen" }]);
    expect(labels.ok && labels.value.valueOf("wool")).toBeUndefined();
    expect(AttributeLabels.empty().valueOf("linen")).toBeUndefined();
  });

  it("rehydrate does not re-judge: a version was judged when it was published (ADR-024)", () => {
    // A duplicate would never reach here; what matters is that reconstructing is not a second gate.
    const labels = AttributeLabels.rehydrate([{ label: "denim 12oz", value: "denim" }]);
    expect(labels.valueOf("denim 12oz")).toBe("denim");
  });
});
