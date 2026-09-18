// Feature 011 (FR-023): the default policy encodes the values proposed to the stakeholder and
// every rule of the spec's Assumptions, by id.
import { describe, expect, it } from "vitest";
import { Signals } from "../../../../src/domain/barrier/index.js";
import { DEFAULT_DECISION_POLICY, DEFAULT_POLICY_VERSION } from "../../../../src/domain/decision/index.js";
import { addedToCart, dwell, removedFromCart, sizeSelector } from "../../../helpers/events.js";

const policy = DEFAULT_DECISION_POLICY;

describe("DEFAULT_DECISION_POLICY", () => {
  it("carries the stakeholder's values", () => {
    expect(policy.version).toBe(DEFAULT_POLICY_VERSION);
    expect(policy.version).toBe("default-1");
    expect(policy.threshold).toBe(0.6);
    expect(policy.rules.weights).toEqual({ strong: 0.4, supporting: 0.2 });
    expect(policy.rules.readingSeconds).toBe(5);
    expect(policy.priority).toEqual(["returns", "fit", "price"]);
    expect(policy.highIntent).toBe("from-checkout");
    expect(policy.abandonment).toBe("reassure-returns");
    expect(policy.interventionsPerSession).toBe(1);
    expect(policy.evidence).toEqual({ freshStockAndPrice: ["price"], availableVariant: ["fit"] });
  });

  it("declares every rule of the spec with its barrier and strength", () => {
    const declared = policy.rules.rules.map((r) => [r.id, r.barrier, r.strength]);
    expect(declared).toEqual([
      ["fit.size-selector-twice", "fit", "strong"],
      ["fit.size-guide-read", "fit", "strong"],
      ["fit.variants-compared", "fit", "strong"],
      ["fit.photo-zoomed", "fit", "supporting"],
      ["fit.returned-to-product", "fit", "supporting"],
      ["price.cart-removed-without-reading", "price", "strong"],
      ["price.price-read", "price", "strong"],
      ["price.returned-and-price-read", "price", "strong"],
      ["price.cta-approached", "price", "supporting"],
      ["price.checkout-then-exit", "price", "supporting"],
      ["returns.policies-read", "returns", "strong"],
      ["returns.cart-then-policies", "returns", "strong"],
      ["returns.size-doubt-and-policies", "returns", "strong"],
      ["returns.photos-and-description", "returns", "supporting"],
      ["returns.policies-then-cart-removed", "returns", "supporting"],
    ]);
  });

  it("one strong signal plus one supporting one reach the threshold; one strong alone does not", () => {
    const product = { attributes: new Map<string, string>(), available: true };
    const strongOnly = policy.rules.infer(Signals.of([sizeSelector(1), sizeSelector(2)]), product);
    expect(strongOnly.confidences.fit).toBe(0.4);
    const two = policy.rules.infer(
      Signals.of([sizeSelector(1), sizeSelector(2), dwell(3, "size_guide", 6000)]),
      product,
    );
    expect(two.confidences.fit).toBe(0.8);
    const abandonment = policy.rules.infer(Signals.of([addedToCart(1), removedFromCart(2)]), product);
    expect(abandonment.confidences).toEqual({ fit: 0, price: 0.4, returns: 0 });
  });
});
