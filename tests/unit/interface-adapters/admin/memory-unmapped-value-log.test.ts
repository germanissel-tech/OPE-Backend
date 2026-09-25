// Feature 027 — US3 (FR-020, FR-021): what the last catalogue brought with no correspondence, per
// merchant, bounded, and without the labels the merchant maps today.
import { describe, expect, it } from "vitest";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";
import { memoryUnmappedValueLog } from "../../../../src/interface-adapters/admin/gateways/memory-unmapped-value-log.js";

const A = asMerchantId("mrc_a");
const B = asMerchantId("mrc_b");
const at = (s: number) => new Date(s * 1000);
const NONE: ReadonlySet<string> = new Set();

describe("memoryUnmappedValueLog", () => {
  it("a catalogue replaces what it reports: a label that stops arriving stops being a gap", async () => {
    const log = memoryUnmappedValueLog(10);
    await log.replace(
      A,
      [
        { label: "Frisa", products: 9 },
        { label: "Nylon", products: 2 },
      ],
      at(1),
    );
    await log.replace(A, [{ label: "Frisa", products: 4 }], at(2));
    const { items } = await log.pendingOf(A, NONE, { limit: 10 });
    // One row, its count from the last catalogue, and the instant it was first seen preserved: a
    // gap that is three catalogues old reads differently from one that appeared today.
    expect(items.map((v) => [v.label, v.products, v.firstSeenAt, v.lastSeenAt])).toEqual([
      ["Frisa", 4, at(1), at(2)],
    ]);
  });

  it("most recent first, and what the merchant maps today is not listed", async () => {
    const log = memoryUnmappedValueLog(10);
    await log.replace(A, [{ label: "Frisa", products: 1 }], at(1));
    await log.replace(
      A,
      [
        { label: "Frisa", products: 1 },
        { label: "Nylon", products: 3 },
        { label: "Lycra", products: 2 },
      ],
      at(2),
    );
    expect((await log.pendingOf(A, NONE, { limit: 10 })).items.map((v) => v.label)).toEqual([
      "Lycra",
      "Nylon",
      "Frisa",
    ]);
    const { items } = await log.pendingOf(A, new Set(["Nylon"]), { limit: 10 });
    expect(items.map((v) => v.label)).toEqual(["Lycra", "Frisa"]);
  });

  it("past the limit the oldest is discarded, and merchants are isolated", async () => {
    const log = memoryUnmappedValueLog(2);
    await log.replace(
      A,
      [
        { label: "Frisa", products: 1 },
        { label: "Nylon", products: 1 },
        { label: "Lycra", products: 1 },
      ],
      at(1),
    );
    // Three arrive in one catalogue and two are kept: with the same first sighting the oldest is
    // the one the catalogue named first.
    expect((await log.pendingOf(A, NONE, { limit: 10 })).items.map((v) => v.label)).toEqual([
      "Lycra",
      "Nylon",
    ]);
    await log.replace(B, [{ label: "Frisa", products: 7 }], at(2));
    expect((await log.pendingOf(A, NONE, { limit: 10 })).items.map((v) => v.label)).toEqual([
      "Lycra",
      "Nylon",
    ]);
    expect((await log.pendingOf(B, NONE, { limit: 10 })).items.map((v) => v.products)).toEqual([7]);
  });

  it("the oldest is the one seen first, whatever order the catalogue names them in", async () => {
    const log = memoryUnmappedValueLog(1);
    await log.replace(A, [{ label: "Frisa", products: 1 }], at(1));
    // The new label comes **first** in the catalogue and the old one second, so keeping the order
    // given and keeping the oldest are two different answers: one keeps Frisa, the other Nylon.
    await log.replace(
      A,
      [
        { label: "Nylon", products: 1 },
        { label: "Frisa", products: 1 },
      ],
      at(2),
    );
    expect((await log.pendingOf(A, NONE, { limit: 10 })).items.map((v) => v.label)).toEqual(["Nylon"]);
  });

  it("a merchant nothing was recorded for reads an empty page, not an error", async () => {
    const log = memoryUnmappedValueLog(2);
    expect(await log.pendingOf(A, NONE, { limit: 10 })).toEqual({ items: [] });
  });

  it("a catalogue with no gap at all empties the report", async () => {
    const log = memoryUnmappedValueLog(2);
    await log.replace(A, [{ label: "Frisa", products: 1 }], at(1));
    await log.replace(A, [], at(2));
    expect((await log.pendingOf(A, NONE, { limit: 10 })).items).toEqual([]);
  });
});
