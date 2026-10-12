// Feature 044 (research R-02, R-09): the test platform answers every read of a source from a script per merchant,
// written as a platform would send it; the file-backed one reads its file on every query; the installed sources
// say what each one reads by, with `generic` always there and reading nothing.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { asVariantId } from "../../../../src/domain/catalog/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";
import {
  fileTestSource,
  installedSources,
  scriptedTestSource,
  type TestPlatformScript,
} from "../../../../src/interface-adapters/platform/index.js";

const A = asMerchantId("m_a");
const B = asMerchantId("m_b");
const PRICE = { amount: "10.00", currency: "ARS" };

const SCRIPT: TestPlatformScript = {
  catalog: {
    capturedAt: "2026-09-19T10:00:00.000Z",
    products: [
      {
        productId: "p1",
        title: "Product",
        attributes: [{ key: "fit", value: "regular" }],
        variants: [
          { variantId: "v1", attributes: [{ key: "size", value: "M" }], available: true, price: PRICE },
          { variantId: "v2", available: false, price: PRICE },
        ],
      },
      { productId: "p2", title: "Other", variants: [] },
    ],
  },
  stockAndPrice: [
    { variantId: "v1", available: false, price: PRICE, observedAt: "2026-09-19T11:00:00.000Z" },
    { variantId: "v2", available: true, price: PRICE },
  ],
  orders: [
    { orderId: "o1", state: "pending", total: PRICE, items: [{ sku: "s", quantity: 1 }] },
    {
      orderId: "o1",
      state: "paid",
      total: PRICE,
      items: [{ sku: "s", quantity: 1 }],
      confirmedAt: "2026-09-19T11:30:00.000Z",
      sessionId: "ses_1",
    },
  ],
  returns: [{ orderId: "o1", returnedAt: "2026-09-19T12:00:00.000Z", items: [{ sku: "s", quantity: 1 }] }],
};

describe("scriptedTestSource", () => {
  it("reads every flow but notices only orders and returns", () => {
    expect(scriptedTestSource().modes).toEqual({
      catalog: ["pull"],
      stockAndPrice: ["pull"],
      orders: ["pull", "subscribe"],
      returns: ["pull", "subscribe"],
    });
  });

  it("answers the catalogue with ids branded, instants as dates and absent attributes as none", async () => {
    const source = scriptedTestSource();
    source.script(A, SCRIPT);
    expect(await source.catalog(A)).toEqual({
      capturedAt: new Date("2026-09-19T10:00:00.000Z"),
      products: [
        {
          productId: "p1",
          title: "Product",
          attributes: [{ key: "fit", value: "regular" }],
          variants: [
            { variantId: "v1", attributes: [{ key: "size", value: "M" }], available: true, price: PRICE },
            { variantId: "v2", attributes: [], available: false, price: PRICE },
          ],
        },
        { productId: "p2", title: "Other", attributes: [], variants: [] },
      ],
    });
  });

  it("a catalogue without an instant answers none, and a merchant without a catalogue is a read that fails", async () => {
    const source = scriptedTestSource();
    source.script(A, { catalog: { products: [] } });
    expect(await source.catalog(A)).toEqual({ capturedAt: undefined, products: [] });
    await expect(source.catalog(B)).rejects.toThrow("The test platform has no catalogue for this merchant.");
  });

  it("answers stock and price only for the variants asked, with the instant only when the platform gives it", async () => {
    const source = scriptedTestSource();
    source.script(A, SCRIPT);
    expect(await source.stockAndPrice(A, [asVariantId("v2")])).toEqual([
      { variantId: "v2", available: true, price: PRICE, observedAt: undefined },
    ]);
    expect(await source.stockAndPrice(A, [asVariantId("v1"), asVariantId("v9")])).toEqual([
      { variantId: "v1", available: false, price: PRICE, observedAt: new Date("2026-09-19T11:00:00.000Z") },
    ]);
    expect(await source.stockAndPrice(B, [asVariantId("v1")])).toEqual([]);
  });

  it("answers the changes after the cursor and the cursor after them, per merchant", async () => {
    const source = scriptedTestSource();
    source.script(A, SCRIPT);
    const all = await source.orderChanges(A, undefined);
    expect(all.cursor).toBe("2");
    expect(all.changes).toEqual([
      {
        orderId: "o1",
        state: "pending",
        total: PRICE,
        items: [{ sku: "s", quantity: 1 }],
        confirmedAt: undefined,
        sessionId: undefined,
      },
      {
        orderId: "o1",
        state: "paid",
        total: PRICE,
        items: [{ sku: "s", quantity: 1 }],
        confirmedAt: new Date("2026-09-19T11:30:00.000Z"),
        sessionId: "ses_1",
      },
    ]);
    expect((await source.orderChanges(A, "1")).changes.map((order) => order.state)).toEqual(["paid"]);
    expect(await source.orderChanges(A, "2")).toEqual({ changes: [], cursor: "2" });
    expect(await source.orderChanges(B, undefined)).toEqual({ changes: [], cursor: "0" });
    expect(await source.returnChanges(A, undefined)).toEqual({
      changes: [
        {
          orderId: "o1",
          returnedAt: new Date("2026-09-19T12:00:00.000Z"),
          items: [{ sku: "s", quantity: 1 }],
        },
      ],
      cursor: "1",
    });
    expect((await source.returnChanges(A, "1")).changes).toEqual([]);
  });

  it("answers the order and the return a notice is about as they are now: the last change of each", async () => {
    const source = scriptedTestSource();
    source.script(A, SCRIPT);
    expect((await source.order(A, "o1"))?.state).toBe("paid");
    expect(await source.order(A, "o9")).toBeUndefined();
    expect(await source.order(B, "o1")).toBeUndefined();
    expect(await source.returnOf(A, "o1")).toEqual({
      orderId: "o1",
      returnedAt: new Date("2026-09-19T12:00:00.000Z"),
      items: [{ sku: "s", quantity: 1 }],
    });
    expect(await source.returnOf(A, "o9")).toBeUndefined();
    source.script(A, {
      returns: [{ orderId: "o1" }, { orderId: "o1", returnedAt: "2026-09-19T13:00:00.000Z" }],
    });
    expect((await source.returnOf(A, "o1"))?.returnedAt).toEqual(new Date("2026-09-19T13:00:00.000Z"));
    expect(await source.returnOf(B, "o1")).toBeUndefined();
  });

  it("a platform that does not answer fails every read", async () => {
    const source = scriptedTestSource();
    source.script(A, { ...SCRIPT, failing: true });
    const reads = [
      source.catalog(A),
      source.stockAndPrice(A, []),
      source.orderChanges(A, undefined),
      source.returnChanges(A, undefined),
      source.order(A, "o1"),
      source.returnOf(A, "o1"),
    ];
    for (const read of reads) await expect(read).rejects.toThrow("The test platform does not answer.");
    source.script(A, { ...SCRIPT, failing: false });
    expect((await source.orderChanges(A, undefined)).changes).toHaveLength(2);
  });
});

describe("fileTestSource", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  });

  it("reads the file on every query, so what is written while it runs is what the next read answers", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "ope-test-platform-"));
    const file = path.join(dir, "platform.json");
    writeFileSync(file, JSON.stringify({ merchants: { m_a: { orders: SCRIPT.orders?.slice(0, 1) } } }));
    const source = fileTestSource(file);
    expect((await source.orderChanges(A, undefined)).cursor).toBe("1");
    writeFileSync(file, JSON.stringify({ merchants: { m_a: SCRIPT } }));
    expect((await source.orderChanges(A, undefined)).cursor).toBe("2");
    expect((await source.catalog(A)).products).toHaveLength(2);
    expect(await source.orderChanges(B, undefined)).toEqual({ changes: [], cursor: "0" });
    writeFileSync(file, JSON.stringify({}));
    expect(await source.orderChanges(A, undefined)).toEqual({ changes: [], cursor: "0" });
  });
});

describe("installedSources", () => {
  it("generic is always installed and reads nothing; another source is installed only if it was given", () => {
    const test = scriptedTestSource();
    const none = { catalog: [], stockAndPrice: [], orders: [], returns: [] };
    const with_ = installedSources(new Map([["test", test]]));
    expect(with_.modesOf("generic")).toEqual(none);
    expect(with_.readerOf("generic")).toBeUndefined();
    expect(with_.modesOf("test")).toBe(test.modes);
    expect(with_.readerOf("test")).toBe(test);
    const without = installedSources(new Map());
    expect(without.modesOf("generic")).toEqual(none);
    expect(without.modesOf("test")).toBeUndefined();
    expect(without.readerOf("test")).toBeUndefined();
  });
});
