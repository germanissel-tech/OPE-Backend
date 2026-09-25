// Feature 027 — US3 (FR-020): of everything a catalogue carries, what gets reported is only what OPE
// could have said something about and could not. The count is of products, so a label ten products
// carry is one row with ten.
import { describe, expect, it } from "vitest";
import { UnmappedValues, type UnmappedValueSighting } from "../../../../src/application/admin/index.js";
import { AttributeLabels } from "../../../../src/domain/messages/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";
import type { Attribute } from "../../../../src/domain/catalog/index.js";

const A = asMerchantId("m_a");
const AT = new Date("2026-09-18T12:00:00.000Z");
const material = (value: string): Attribute => ({ key: "material", value });

/** A merchant that declared the correspondence of the worked example, or nothing at all. */
const subject = (declared: readonly { label: string; value: string }[]) => {
  const labels = AttributeLabels.of(declared);
  if (!labels.ok) throw new Error(labels.error.message);
  const recorded: { seen: readonly UnmappedValueSighting[]; at: Date }[] = [];
  const service = new UnmappedValues({
    directory: { settingsFor: () => Promise.resolve({ voice: "neutral", labels: labels.value }) },
    log: {
      replace: (_m, seen, at) => {
        recorded.push({ seen, at });
        return Promise.resolve();
      },
      pendingOf: () => Promise.reject(new Error("the report is not read while it is written")),
    },
  });
  return { service, recorded };
};

describe("UnmappedValues", () => {
  it("counts products per label, and says nothing of what the merchant did map", async () => {
    const { service, recorded } = subject([{ label: "Denim 12oz", value: "denim" }]);
    await service.record(
      A,
      [material("Frisa"), material("Denim 12oz"), material("Frisa"), material("Nylon")],
      AT,
    );
    expect(recorded).toEqual([
      {
        seen: [
          { label: "Frisa", products: 2 },
          { label: "Nylon", products: 1 },
        ],
        at: AT,
      },
    ]);
  });

  it("a key OPE does not write about is not a gap, and neither is an empty value", async () => {
    const { service, recorded } = subject([]);
    await service.record(A, [{ key: "care", value: "Lavar a mano" }, material("")], AT);
    expect(recorded).toEqual([{ seen: [], at: AT }]);
  });

  it("a merchant that declared no correspondence has every label unmapped: that is the report, not a fault", async () => {
    const { service, recorded } = subject([]);
    await service.record(A, [material("Combed Cotton 24/1")], AT);
    expect(recorded[0]?.seen).toEqual([{ label: "Combed Cotton 24/1", products: 1 }]);
  });
});
