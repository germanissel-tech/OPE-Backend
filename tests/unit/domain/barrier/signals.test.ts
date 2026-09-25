// Feature 011 (R-03): signals are the aggregation of events in the closed vocabulary, and a
// monoid so the batch merges into the session.
import { describe, expect, it } from "vitest";
import { Signals } from "../../../../src/domain/barrier/index.js";
import {
  addedToCart,
  cta,
  dwell,
  exit,
  photo,
  removedFromCart,
  variantSelector,
  variantSelected,
  viewed,
} from "../../../helpers/events.js";

describe("Signals.of", () => {
  it("counts by type and, for the types with a subtype, by type:subtype", () => {
    const s = Signals.of([photo(1, "zoom"), photo(2, "navigate"), photo(3, "zoom"), variantSelector(4)]);
    expect(s.count({ type: "photo_interacted" })).toBe(3);
    expect(s.count({ type: "photo_interacted", subtype: "zoom" })).toBe(2);
    expect(s.count({ type: "photo_interacted", subtype: "navigate" })).toBe(1);
    expect(s.count({ type: "variant_selector_interacted" })).toBe(1);
    expect(s.count({ type: "added_to_cart" })).toBe(0);
    expect(s.count({ type: "variant_selector_interacted", subtype: "M" })).toBe(0);
  });

  it("every subtyped event counts by its own subtype: cta approach, exit signal; variant selection only by type", () => {
    const s = Signals.of([
      cta(1, "near"),
      cta(2, "hover"),
      exit(3, "tab_hidden"),
      variantSelected(4),
      variantSelected(5),
    ]);
    expect(s.count({ type: "cta_approached", subtype: "near" })).toBe(1);
    expect(s.count({ type: "cta_approached" })).toBe(2);
    expect(s.count({ type: "exit_signaled", subtype: "tab_hidden" })).toBe(1);
    expect(s.count({ type: "exit_signaled", subtype: "exit_intent" })).toBe(0);
    expect(s.count({ type: "variant_selected" })).toBe(2);
  });

  it("adds up the dwell of a block, in seconds", () => {
    const s = Signals.of([dwell(1, "policies", 2500), dwell(2, "policies", 3500), dwell(3, "price", 1000)]);
    expect(s.dwellSeconds("policies")).toBe(6);
    expect(s.dwellSeconds("price")).toBe(1);
    expect(s.dwellSeconds("reviews")).toBe(0);
    expect(s.count({ type: "block_dwelled", subtype: "policies" })).toBe(2);
  });

  it("sequence(a, b): some a strictly before some b, whatever the batch order", () => {
    const s = Signals.of([removedFromCart(10), addedToCart(5), dwell(7, "policies", 1000)]);
    expect(s.sequence({ type: "added_to_cart" }, { type: "removed_from_cart" })).toBe(true);
    expect(s.sequence({ type: "added_to_cart" }, { type: "block_dwelled", subtype: "policies" })).toBe(true);
    expect(s.sequence({ type: "removed_from_cart" }, { type: "added_to_cart" })).toBe(false);
    expect(s.sequence({ type: "added_to_cart" }, { type: "checkout_advanced" })).toBe(false);
    // Repeated keys out of order: the earliest first and the latest last decide.
    const twice = Signals.of([addedToCart(9), addedToCart(1), removedFromCart(0), removedFromCart(5)]);
    expect(twice.sequence({ type: "added_to_cart" }, { type: "removed_from_cart" })).toBe(true);
    expect(twice.sequence({ type: "removed_from_cart" }, { type: "added_to_cart" })).toBe(true);
    const only = Signals.of([addedToCart(9), addedToCart(1), removedFromCart(0)]);
    expect(only.sequence({ type: "added_to_cart" }, { type: "removed_from_cart" })).toBe(false);
    expect(
      Signals.of([addedToCart(5), removedFromCart(5)]).sequence(
        { type: "added_to_cart" },
        { type: "removed_from_cart" },
      ),
    ).toBe(false);
  });
});

describe("Signals as a monoid", () => {
  const a = Signals.of([variantSelector(1), dwell(2, "size_guide", 3000), addedToCart(9)]);
  const b = Signals.of([variantSelector(20), dwell(21, "size_guide", 3000), removedFromCart(30)]);
  const c = Signals.of([viewed(40)]);

  it("empty is the identity and nothing was seen", () => {
    expect(Signals.empty().isEmpty()).toBe(true);
    expect(a.isEmpty()).toBe(false);
    expect(same(Signals.empty().merge(a), a)).toBe(true);
    expect(same(a.merge(Signals.empty()), a)).toBe(true);
  });

  it("merge adds counts and dwell, keeps the earliest first and the latest last", () => {
    const m = a.merge(b);
    expect(m.count({ type: "variant_selector_interacted" })).toBe(2);
    expect(m.dwellSeconds("size_guide")).toBe(6);
    expect(m.sequence({ type: "added_to_cart" }, { type: "removed_from_cart" })).toBe(true);
    expect(m.sequence({ type: "variant_selector_interacted" }, { type: "removed_from_cart" })).toBe(true);
    expect(b.merge(a).sequence({ type: "added_to_cart" }, { type: "removed_from_cart" })).toBe(true);
  });

  it("is associative", () => {
    expect(same(a.merge(b).merge(c), a.merge(b.merge(c)))).toBe(true);
  });

  it("does not mutate its operands", () => {
    a.merge(b);
    expect(a.count({ type: "variant_selector_interacted" })).toBe(1);
    expect(b.dwellSeconds("size_guide")).toBe(3);
  });
});

/** Observational equality over the vocabulary the tests use. */
function same(x: Signals, y: Signals): boolean {
  const refs = [
    { type: "variant_selector_interacted" as const },
    { type: "added_to_cart" as const },
    { type: "removed_from_cart" as const },
    { type: "product_viewed" as const },
    { type: "block_dwelled" as const, subtype: "size_guide" },
  ];
  return (
    refs.every((r) => x.count(r) === y.count(r)) &&
    x.dwellSeconds("size_guide") === y.dwellSeconds("size_guide") &&
    refs.every((r) => refs.every((t) => x.sequence(r, t) === y.sequence(r, t)))
  );
}
