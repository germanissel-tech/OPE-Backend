// The decision policy a merchant gets when it declares none (ADR-026): the values proposed to
// the stakeholder in feature 011 — one strong signal plus one supporting one (0.4 + 0.2 over a
// 0.6 threshold), five seconds of reading, returns before fit before price on a tie, fresh stock
// and price only for price, an available variant for fit. What is commercial (high intent,
// abandonment, budgets) lives in the default commercial policy (feature 012).
// Built by the factories at load time: an invalid default is a programming error.
import { BarrierRules, type Rule } from "../barrier/index.js";
import { DecisionPolicy } from "./decision-policy.js";
import type { Block } from "../ingestion/index.js";

export const DEFAULT_POLICY_VERSION = "default-1";

const READING_SECONDS = 5;
const THRESHOLD = 0.6;
const STRONG = 0.4;
const SUPPORTING = 0.2;
const TWICE = 2;
const THRICE = 3;
const LONG_READ_SECONDS = 10;
/** As a subtype of `block_dwelled` the block is a plain string: named once for the sequences. */
const POLICIES: Block = "policies";

/** The rules, translated from the signals presented to the stakeholder (spec 011, Assumptions). */
const DEFAULT_RULES: readonly Rule[] = [
  {
    id: "fit.size-selector-twice",
    barrier: "fit",
    strength: "strong",
    when: {
      all: [
        { fact: "eventCount", type: "size_selector_interacted", min: TWICE },
        { not: { fact: "sessionAddedToCart" } },
      ],
    },
  },
  {
    id: "fit.size-guide-read",
    barrier: "fit",
    strength: "strong",
    when: { fact: "dwellSeconds", block: "size_guide" },
  },
  {
    id: "fit.variants-compared",
    barrier: "fit",
    strength: "strong",
    when: { fact: "eventCount", type: "variant_selected", min: TWICE },
  },
  {
    id: "fit.photo-zoomed",
    barrier: "fit",
    strength: "supporting",
    when: { fact: "eventCount", type: "photo_interacted", subtype: "zoom", min: TWICE },
  },
  {
    id: "fit.returned-to-product",
    barrier: "fit",
    strength: "supporting",
    when: { fact: "returnedToProduct" },
  },
  {
    id: "price.cart-removed-without-reading",
    barrier: "price",
    strength: "strong",
    when: {
      all: [
        { fact: "sequence", first: { type: "added_to_cart" }, then: { type: "removed_from_cart" } },
        { not: { fact: "dwellSeconds", block: "size_guide" } },
        { not: { fact: "dwellSeconds", block: "policies" } },
      ],
    },
  },
  {
    id: "price.price-read",
    barrier: "price",
    strength: "strong",
    when: { fact: "dwellSeconds", block: "price" },
  },
  {
    id: "price.returned-and-price-read",
    barrier: "price",
    strength: "strong",
    when: { all: [{ fact: "returnedToProduct" }, { fact: "dwellSeconds", block: "price" }] },
  },
  {
    id: "price.cta-approached",
    barrier: "price",
    strength: "supporting",
    when: { fact: "eventCount", type: "cta_approached", min: 1 },
  },
  {
    id: "price.checkout-then-exit",
    barrier: "price",
    strength: "supporting",
    when: {
      all: [
        { fact: "eventCount", type: "checkout_advanced", min: 1 },
        { fact: "eventCount", type: "exit_signaled", min: 1 },
      ],
    },
  },
  {
    id: "returns.policies-read",
    barrier: "returns",
    strength: "strong",
    when: { fact: "dwellSeconds", block: "policies" },
  },
  {
    id: "returns.cart-then-policies",
    barrier: "returns",
    strength: "strong",
    when: {
      fact: "sequence",
      first: { type: "added_to_cart" },
      then: { type: "block_dwelled", subtype: POLICIES },
    },
  },
  {
    id: "returns.size-doubt-and-policies",
    barrier: "returns",
    strength: "strong",
    when: {
      all: [
        { fact: "eventCount", type: "size_selector_interacted", min: TWICE },
        { fact: "dwellSeconds", block: "policies" },
      ],
    },
  },
  {
    id: "returns.photos-and-description",
    barrier: "returns",
    strength: "supporting",
    when: {
      all: [
        { fact: "eventCount", type: "photo_interacted", min: THRICE },
        { fact: "dwellSeconds", block: "description", min: LONG_READ_SECONDS },
      ],
    },
  },
  {
    id: "returns.policies-then-cart-removed",
    barrier: "returns",
    strength: "supporting",
    when: {
      fact: "sequence",
      first: { type: "block_dwelled", subtype: POLICIES },
      then: { type: "removed_from_cart" },
    },
  },
];

function build(): DecisionPolicy {
  const rules = BarrierRules.of({
    rules: DEFAULT_RULES,
    weights: { strong: STRONG, supporting: SUPPORTING },
    readingSeconds: READING_SECONDS,
  });
  if (!rules.ok) throw new Error(`The default barrier rules are invalid: ${rules.error.message}`);
  const policy = DecisionPolicy.of({
    version: DEFAULT_POLICY_VERSION,
    rules: rules.value,
    threshold: THRESHOLD,
    priority: ["returns", "fit", "price"],
    evidence: { freshStockAndPrice: ["price"], availableVariant: ["fit"] },
  });
  if (!policy.ok) throw new Error(`The default decision policy is invalid: ${policy.error.message}`);
  return policy.value;
}

export const DEFAULT_DECISION_POLICY: DecisionPolicy = build();
