// The test platform (feature 044; research R-09): every read of the port in every mode it exists for, with no
// platform behind it. What it answers is a script per merchant, written as a platform would send it — ids and
// instants as text — so the same script works scripted from a test and written in a file by hand.
//
// It is installed only where it is asked for: always in the local deployment, and in the durable one only with
// `OPE_TEST_PLATFORM`. A server without the variable does not have it, and the configuration refuses a merchant
// that names it.
import { readFile } from "node:fs/promises";
import { asProductId, asVariantId, type Product } from "../../../domain/catalog/index.js";
import { asOrderId, type OrderItem } from "../../../domain/outcomes/index.js";
import { asSessionId, type MerchantId, type MoneyRecord } from "../../../domain/shared-kernel/index.js";
import type { SourceModes } from "../../../domain/platform/index.js";
import type { PlatformSource, SourceOrder, SourceReturn } from "../source.js";

interface ScriptedAttribute {
  key: string;
  value: string;
}

export interface ScriptedProduct {
  productId: string;
  title: string;
  attributes?: ScriptedAttribute[];
  variants: { variantId: string; attributes?: ScriptedAttribute[]; available: boolean; price: MoneyRecord }[];
}

export interface ScriptedOrder {
  orderId: string;
  state: string;
  total: MoneyRecord;
  items: OrderItem[];
  confirmedAt?: string;
  sessionId?: string;
}

export interface ScriptedReturn {
  orderId: string;
  returnedAt?: string;
  items?: OrderItem[];
}

/**
 * What the platform of one merchant holds. `orders` and `returns` are **changes in the order they happened**: an
 * order that moves from one state to another appears twice, and the cursor is how many were already read.
 */
export interface TestPlatformScript {
  catalog?: { capturedAt?: string; products: ScriptedProduct[] };
  stockAndPrice?: { variantId: string; available: boolean; price: MoneyRecord; observedAt?: string }[];
  orders?: ScriptedOrder[];
  returns?: ScriptedReturn[];
  /** A platform that does not answer: every read throws. */
  failing?: boolean;
}

/** What the test platform reads each flow by: everything, except a notice of a state (ADR-047). */
const MODES: SourceModes = {
  catalog: ["pull"],
  stockAndPrice: ["pull"],
  orders: ["pull", "subscribe"],
  returns: ["pull", "subscribe"],
};

const instant = (text: string | undefined): Date | undefined =>
  text === undefined ? undefined : new Date(text);

const productOf = (scripted: ScriptedProduct): Product => ({
  productId: asProductId(scripted.productId),
  title: scripted.title,
  attributes: scripted.attributes ?? [],
  variants: scripted.variants.map((variant) => ({
    variantId: asVariantId(variant.variantId),
    attributes: variant.attributes ?? [],
    available: variant.available,
    price: variant.price,
  })),
});

const orderOf = (scripted: ScriptedOrder): SourceOrder => ({
  orderId: asOrderId(scripted.orderId),
  state: scripted.state,
  total: scripted.total,
  items: scripted.items,
  confirmedAt: instant(scripted.confirmedAt),
  // Stryker disable next-line ConditionalExpression: asSessionId is a brand, on undefined it yields undefined
  sessionId: scripted.sessionId === undefined ? undefined : asSessionId(scripted.sessionId),
});

const returnOf = (scripted: ScriptedReturn): SourceReturn => ({
  orderId: asOrderId(scripted.orderId),
  returnedAt: instant(scripted.returnedAt),
  items: scripted.items,
});

/** The changes after the cursor, and the cursor after them: how many changes were already read. */
function changesAfter<S, T>(all: readonly S[] | undefined, cursor: string | undefined, as: (s: S) => T) {
  const list = all ?? [];
  return { changes: list.slice(Number(cursor ?? 0)).map(as), cursor: String(list.length) };
}

/** A source over whatever answers the script of a merchant, read again on every query. */
function testSource(scriptOf: (merchantId: MerchantId) => Promise<TestPlatformScript>): PlatformSource {
  const answering = async (merchantId: MerchantId): Promise<TestPlatformScript> => {
    const script = await scriptOf(merchantId);
    if (script.failing === true) throw new Error("The test platform does not answer.");
    return script;
  };
  return {
    modes: MODES,
    async catalog(merchantId) {
      const { catalog } = await answering(merchantId);
      if (catalog === undefined) throw new Error("The test platform has no catalogue for this merchant.");
      return { capturedAt: instant(catalog.capturedAt), products: catalog.products.map(productOf) };
    },
    async stockAndPrice(merchantId, variantIds) {
      const { stockAndPrice = [] } = await answering(merchantId);
      return stockAndPrice
        .filter((item) => variantIds.includes(asVariantId(item.variantId)))
        .map((item) => ({
          ...item,
          variantId: asVariantId(item.variantId),
          observedAt: instant(item.observedAt),
        }));
    },
    orderChanges: async (merchantId, cursor) =>
      changesAfter((await answering(merchantId)).orders, cursor, orderOf),
    returnChanges: async (merchantId, cursor) =>
      changesAfter((await answering(merchantId)).returns, cursor, returnOf),
    // What a notice reads is the order as it is now: the last change of it, which is how a platform answers.
    order: async (merchantId, reference) => {
      const changes = (await answering(merchantId)).orders ?? [];
      const last = changes.filter((order) => order.orderId === reference).at(-1);
      return last === undefined ? undefined : orderOf(last);
    },
    returnOf: async (merchantId, reference) => {
      const changes = (await answering(merchantId)).returns ?? [];
      const last = changes.filter((returned) => returned.orderId === reference).at(-1);
      return last === undefined ? undefined : returnOf(last);
    },
  };
}

/** The test platform a test scripts: what each merchant's platform holds, changed between runs at will. */
export interface ScriptedTestSource extends PlatformSource {
  script(merchantId: MerchantId, script: TestPlatformScript): void;
}

export function scriptedTestSource(): ScriptedTestSource {
  const scripts = new Map<MerchantId, TestPlatformScript>();
  return {
    ...testSource((merchantId) => Promise.resolve(scripts.get(merchantId) ?? {})),
    script: (merchantId, script) => scripts.set(merchantId, script),
  };
}

/**
 * The test platform of `npm run dev`: a JSON file `{ "merchants": { "<merchantId>": <script> } }`, read on every
 * query, so an order is added by editing the file while the server runs.
 *
 * The file is the developer's and is not judged here: what it says is cast to the script, and a read that finds
 * something else throws inside the run, which the scheduler records as failed with the merchant and the flow.
 */
export function fileTestSource(path: string): PlatformSource {
  return testSource(async (merchantId) => {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    const merchants = (parsed as { merchants?: Record<string, TestPlatformScript> }).merchants ?? {};
    return merchants[merchantId] ?? {};
  });
}
