// Feature 011 (FR-012, FR-013, FR-022; SC-002, SC-003): a rule set only exists valid, and its
// inference is pure and deterministic.
import { describe, expect, it } from "vitest";
import {
  BarrierRules,
  BarrierWithoutRules,
  DuplicateRuleId,
  InvalidRuleThreshold,
  InvalidRuleWeight,
  Signals,
  UnknownBarrier,
  UnknownFact,
  type BarrierRulesRecord,
  type ProductFacts,
  type Rule,
} from "../../../../src/domain/barrier/index.js";
import { addedToCart, dwell, photo, sizeSelector } from "../../../helpers/events.js";

const rule = (over: Partial<Rule> & Pick<Rule, "id" | "barrier">): Rule => ({
  when: { fact: "eventCount", type: "size_selector_interacted", min: 2 },
  strength: "strong",
  ...over,
});
const base: BarrierRulesRecord = {
  weights: { strong: 0.4, supporting: 0.2 },
  readingSeconds: 5,
  rules: [
    rule({ id: "fit.size-selector-twice", barrier: "fit" }),
    rule({ id: "fit.size-guide-read", barrier: "fit", when: { fact: "dwellSeconds", block: "size_guide" } }),
    rule({
      id: "fit.photo-zoomed",
      barrier: "fit",
      strength: "supporting",
      when: { fact: "eventCount", type: "photo_interacted", subtype: "zoom", min: 2 },
    }),
    rule({
      id: "price.cart-removed",
      barrier: "price",
      when: { fact: "sequence", first: { type: "added_to_cart" }, then: { type: "removed_from_cart" } },
    }),
    rule({
      id: "returns.policies-read",
      barrier: "returns",
      when: { fact: "dwellSeconds", block: "policies" },
    }),
  ],
};
const product: ProductFacts = { attributes: new Map(), available: true };

function valid(record: BarrierRulesRecord): BarrierRules {
  const built = BarrierRules.of(record);
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

const ERROR_BY_CODE = {
  "invalid-rule-weight": InvalidRuleWeight,
  "invalid-rule-threshold": InvalidRuleThreshold,
  "duplicate-rule-id": DuplicateRuleId,
  "unknown-barrier": UnknownBarrier,
  "unknown-fact": UnknownFact,
  "barrier-without-rules": BarrierWithoutRules,
} as const;

function rejected(record: BarrierRulesRecord): { code: string; details: Record<string, unknown> } {
  const built = BarrierRules.of(record);
  if (built.ok) throw new Error("expected a rejection");
  expect(built.error).toBeInstanceOf(ERROR_BY_CODE[built.error.code]);
  expect(built.error.module).toBe("barrier");
  return { code: built.error.code, details: built.error.details };
}

const withRule = (r: BarrierRulesRecord, extra: Rule): BarrierRulesRecord => ({
  ...r,
  rules: [...r.rules, extra],
});

describe("BarrierRules.of — invariants (SC-003)", () => {
  it("accepts the base rule set and exposes its record", () => {
    const rules = valid(base);
    expect(rules.rules).toHaveLength(5);
    expect(rules.weights).toEqual({ strong: 0.4, supporting: 0.2 });
    expect(rules.readingSeconds).toBe(5);
  });

  it.each<[string, (r: BarrierRulesRecord) => BarrierRulesRecord, string, Record<string, unknown>]>([
    [
      "strong weight above 1",
      (r) => ({ ...r, weights: { strong: 1.5, supporting: 0.2 } }),
      "invalid-rule-weight",
      { path: "weights.strong" },
    ],
    [
      "supporting weight negative",
      (r) => ({ ...r, weights: { strong: 0.4, supporting: -0.1 } }),
      "invalid-rule-weight",
      { path: "weights.supporting" },
    ],
    [
      "reading seconds negative",
      (r) => ({ ...r, readingSeconds: -1 }),
      "invalid-rule-threshold",
      { path: "readingSeconds" },
    ],
    [
      "rule weight above 1",
      (r) => ({ ...r, rules: [rule({ id: "x", barrier: "fit", weight: 2 }), ...r.rules] }),
      "invalid-rule-weight",
      { path: "weight", index: 0 },
    ],
    [
      "empty id",
      (r) => withRule(r, rule({ id: "", barrier: "fit" })),
      "duplicate-rule-id",
      { path: "id", index: 5 },
    ],
    [
      "duplicate id",
      (r) => withRule(r, rule({ id: "fit.size-selector-twice", barrier: "fit" })),
      "duplicate-rule-id",
      { path: "id", index: 5 },
    ],
    [
      "unknown barrier",
      (r) => withRule(r, rule({ id: "v", barrier: "variant" as never })),
      "unknown-barrier",
      { path: "barrier", index: 5 },
    ],
    [
      "unknown event type",
      (r) =>
        withRule(
          r,
          rule({
            id: "t",
            barrier: "fit",
            when: { fact: "eventCount", type: "footer_seen" as never, min: 1 },
          }),
        ),
      "unknown-fact",
      { path: "when.type", index: 5 },
    ],
    [
      "unknown subtype",
      (r) =>
        withRule(
          r,
          rule({
            id: "s",
            barrier: "fit",
            when: { fact: "eventCount", type: "photo_interacted", subtype: "pinch", min: 1 },
          }),
        ),
      "unknown-fact",
      { path: "when.subtype", index: 5 },
    ],
    [
      "subtype on a type without one",
      (r) =>
        withRule(
          r,
          rule({
            id: "s2",
            barrier: "fit",
            when: { fact: "eventCount", type: "added_to_cart", subtype: "x", min: 1 },
          }),
        ),
      "unknown-fact",
      { path: "when.subtype", index: 5 },
    ],
    [
      "unknown block, nested",
      (r) =>
        withRule(
          r,
          rule({
            id: "b",
            barrier: "fit",
            when: {
              all: [
                { fact: "returnedToProduct" },
                { not: { fact: "dwellSeconds", block: "footer" as never } },
              ],
            },
          }),
        ),
      "unknown-fact",
      { path: "when.all[1].not.block", index: 5 },
    ],
    [
      "negative min",
      (r) =>
        withRule(
          r,
          rule({
            id: "m",
            barrier: "fit",
            when: { any: [{ fact: "eventCount", type: "cta_approached", min: -1 }] },
          }),
        ),
      "invalid-rule-threshold",
      { path: "when.any[0].min", index: 5 },
    ],
    [
      "negative dwell min",
      (r) =>
        withRule(
          r,
          rule({ id: "d", barrier: "fit", when: { fact: "dwellSeconds", block: "price", min: -5 } }),
        ),
      "invalid-rule-threshold",
      { path: "when.min", index: 5 },
    ],
    [
      "sequence with unknown then type",
      (r) =>
        withRule(
          r,
          rule({
            id: "q",
            barrier: "fit",
            when: { fact: "sequence", first: { type: "added_to_cart" }, then: { type: "paid" as never } },
          }),
        ),
      "unknown-fact",
      { path: "when.then.type", index: 5 },
    ],
    [
      "a barrier without rules",
      (r) => ({ ...r, rules: r.rules.filter((x) => x.barrier !== "price") }),
      "barrier-without-rules",
      { path: "rules" },
    ],
  ])("rejects %s naming the field", (_name, mutate, code, details) => {
    expect(rejected(mutate(base))).toEqual({ code, details });
  });

  it("the boundaries are inside: weights 0 and 1, reading seconds 0, min 0, an explicit weight of 1", () => {
    const edge = valid({
      ...base,
      weights: { strong: 1, supporting: 0 },
      readingSeconds: 0,
      rules: [
        rule({
          id: "e1",
          barrier: "fit",
          weight: 1,
          when: { fact: "eventCount", type: "added_to_cart", min: 0 },
        }),
        rule({
          id: "e2",
          barrier: "price",
          weight: 0,
          when: { fact: "dwellSeconds", block: "price", min: 0 },
        }),
        rule({ id: "e3", barrier: "returns" }),
      ],
    });
    expect(edge.weights).toEqual({ strong: 1, supporting: 0 });
    expect(edge.infer(Signals.empty(), product).confidences).toEqual({ fit: 1, price: 0, returns: 0 });
    expect(rejected({ ...base, weights: { strong: 1.0001, supporting: 0 } }).code).toBe(
      "invalid-rule-weight",
    );
    expect(rejected({ ...base, weights: { strong: 1, supporting: -0.0001 } }).code).toBe(
      "invalid-rule-weight",
    );
    expect(rejected({ ...base, readingSeconds: Number.NaN }).code).toBe("invalid-rule-threshold");
  });

  it("names an empty id and a repeated id differently", () => {
    const empty = BarrierRules.of(withRule(base, rule({ id: "", barrier: "fit" })));
    expect(!empty.ok && empty.error.message).toBe("A rule id is empty.");
    const twice = BarrierRules.of(withRule(base, rule({ id: "price.cart-removed", barrier: "fit" })));
    expect(!twice.ok && twice.error.message).toBe('Rule id "price.cart-removed" is declared twice.');
  });

  it("rehydrate does not re-judge the invariants", () => {
    const rules = BarrierRules.rehydrate({ ...base, weights: { strong: 5, supporting: 0 } });
    expect(rules.weights.strong).toBe(5);
  });
});

describe("BarrierRules.infer (FR-012, FR-013)", () => {
  // Built inside each test, never at collection time: a mutant that breaks `of` must fail a test, not the file.
  const rules = (): BarrierRules => valid(base);

  it("sums the weights of the rules that hold, per barrier, and lists them in declaration order", () => {
    const signals = Signals.of([
      sizeSelector(1),
      sizeSelector(2),
      photo(3),
      photo(4),
      dwell(5, "policies", 6000),
    ]);
    const inference = rules().infer(signals, product);
    expect(inference.confidences).toEqual({ fit: 0.6, price: 0, returns: 0.4 });
    expect(inference.matched).toEqual([
      "fit.size-selector-twice",
      "fit.photo-zoomed",
      "returns.policies-read",
    ]);
  });

  it("caps the confidence at 1 and rounds so that sums compare exactly", () => {
    const many = valid({
      ...base,
      rules: [
        ...base.rules,
        rule({ id: "fit.a", barrier: "fit", weight: 0.7 }),
        rule({ id: "fit.b", barrier: "fit", weight: 0.1 }),
        rule({ id: "fit.c", barrier: "fit", weight: 0.2 }),
      ],
    });
    const signals = Signals.of([sizeSelector(1), sizeSelector(2)]);
    expect(many.infer(signals, product).confidences.fit).toBe(1);
    const three = valid({
      ...base,
      weights: { strong: 0.1, supporting: 0.2 },
      rules: [
        rule({ id: "f1", barrier: "fit" }),
        rule({ id: "f2", barrier: "fit" }),
        rule({ id: "f3", barrier: "fit", strength: "supporting" }),
        rule({ id: "p", barrier: "price" }),
        rule({ id: "r", barrier: "returns" }),
      ],
    });
    expect(three.infer(signals, product).confidences.fit).toBe(0.4);
  });

  it("an explicit weight overrides the strength weight", () => {
    const custom = valid({
      ...base,
      rules: base.rules.map((r) => (r.id === "fit.size-selector-twice" ? { ...r, weight: 0.25 } : r)),
    });
    expect(custom.infer(Signals.of([sizeSelector(1), sizeSelector(2)]), product).confidences.fit).toBe(0.25);
    expect(custom.weightOf({ id: "z", barrier: "fit", strength: "supporting", when: { all: [] } })).toBe(0.2);
  });

  it("nothing holds → every confidence 0 and no match", () => {
    expect(rules().infer(Signals.empty(), product)).toEqual({
      confidences: { fit: 0, price: 0, returns: 0 },
      matched: [],
    });
  });

  it("is deterministic: 1 000 evaluations of the same context give the same inference", () => {
    const signals = Signals.of([
      addedToCart(1),
      sizeSelector(2),
      sizeSelector(3),
      dwell(4, "size_guide", 5000),
    ]);
    const built = rules();
    const first = built.infer(signals, product);
    for (let i = 0; i < 1000; i++) expect(built.infer(signals, product)).toEqual(first);
    expect(first.confidences).toEqual({ fit: 0.8, price: 0, returns: 0 });
  });
});
