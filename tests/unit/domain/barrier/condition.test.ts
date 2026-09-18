// Feature 011 (FR-021): the condition algebra by table — every predicate true and false, the
// identities of all/any, not, and nesting.
import { describe, expect, it } from "vitest";
import {
  FactContext,
  Signals,
  type Condition,
  type ProductFacts,
} from "../../../../src/domain/barrier/index.js";
import {
  addedToCart,
  checkout,
  dwell,
  photo,
  removedFromCart,
  returned,
  sizeSelector,
} from "../../../helpers/events.js";

const signals = Signals.of([
  sizeSelector(1),
  sizeSelector(2),
  photo(3, "zoom"),
  dwell(4, "policies", 6000),
  addedToCart(5),
  removedFromCart(6),
  returned(7),
]);
const product: ProductFacts = { attributes: new Map([["category", "shoes"]]), available: true };
const context = FactContext.of({ signals, product, readingSeconds: 5 });

const T: Condition = { fact: "returnedToProduct" };
const F: Condition = { fact: "sessionEnteredCheckout" };

describe("FactContext.holds — predicates", () => {
  it.each<[string, Condition, boolean]>([
    ["eventCount met", { fact: "eventCount", type: "size_selector_interacted", min: 2 }, true],
    ["eventCount not met", { fact: "eventCount", type: "size_selector_interacted", min: 3 }, false],
    [
      "eventCount with subtype",
      { fact: "eventCount", type: "photo_interacted", subtype: "zoom", min: 1 },
      true,
    ],
    [
      "eventCount with other subtype",
      { fact: "eventCount", type: "photo_interacted", subtype: "navigate", min: 1 },
      false,
    ],
    ["dwellSeconds explicit min met", { fact: "dwellSeconds", block: "policies", min: 6 }, true],
    ["dwellSeconds explicit min not met", { fact: "dwellSeconds", block: "policies", min: 7 }, false],
    ["dwellSeconds without min uses readingSeconds (5)", { fact: "dwellSeconds", block: "policies" }, true],
    ["dwellSeconds of an unread block", { fact: "dwellSeconds", block: "price" }, false],
    [
      "sequence in order",
      { fact: "sequence", first: { type: "added_to_cart" }, then: { type: "removed_from_cart" } },
      true,
    ],
    [
      "sequence reversed",
      { fact: "sequence", first: { type: "removed_from_cart" }, then: { type: "added_to_cart" } },
      false,
    ],
    [
      "sequence with subtype",
      {
        fact: "sequence",
        first: { type: "size_selector_interacted" },
        then: { type: "block_dwelled", subtype: "policies" },
      },
      true,
    ],
    ["returnedToProduct", { fact: "returnedToProduct" }, true],
    ["productAttribute equal", { fact: "productAttribute", key: "category", value: "shoes" }, true],
    ["productAttribute different value", { fact: "productAttribute", key: "category", value: "hats" }, false],
    ["productAttribute unknown key", { fact: "productAttribute", key: "brand", value: "x" }, false],
    ["variantAvailable", { fact: "variantAvailable" }, true],
    ["sessionAddedToCart", { fact: "sessionAddedToCart" }, true],
    ["sessionEnteredCheckout", { fact: "sessionEnteredCheckout" }, false],
  ])("%s", (_name, condition, expected) => {
    expect(context.holds(condition)).toBe(expected);
  });

  it("without a variant in focus, variantAvailable is false; with an unavailable one too", () => {
    const noVariant = FactContext.of({ signals, product: { attributes: new Map() }, readingSeconds: 5 });
    expect(noVariant.holds({ fact: "variantAvailable" })).toBe(false);
    const unavailable = FactContext.of({
      signals,
      product: { attributes: new Map(), available: false },
      readingSeconds: 5,
    });
    expect(unavailable.holds({ fact: "variantAvailable" })).toBe(false);
  });

  it("sessionEnteredCheckout holds once a checkout step was seen", () => {
    const entered = FactContext.of({
      signals: Signals.of([checkout(1, "payment")]),
      product,
      readingSeconds: 5,
    });
    expect(entered.holds({ fact: "sessionEnteredCheckout" })).toBe(true);
    expect(entered.holds({ fact: "sessionAddedToCart" })).toBe(false);
  });
});

describe("FactContext.holds — combinators", () => {
  it.each<[string, Condition, boolean]>([
    ["all([]) is true", { all: [] }, true],
    ["any([]) is false", { any: [] }, false],
    ["all(T, T)", { all: [T, T] }, true],
    ["all(T, F)", { all: [T, F] }, false],
    ["any(F, T)", { any: [F, T] }, true],
    ["any(F, F)", { any: [F, F] }, false],
    ["not(F)", { not: F }, true],
    ["not(T)", { not: T }, false],
    [
      "three levels: all(any(F, not(F)), not(all(T, F)))",
      { all: [{ any: [F, { not: F }] }, { not: { all: [T, F] } }] },
      true,
    ],
    ["three levels false: all(any(F, not(T)), T)", { all: [{ any: [F, { not: T }] }, T] }, false],
  ])("%s", (_name, condition, expected) => {
    expect(context.holds(condition)).toBe(expected);
  });
});
