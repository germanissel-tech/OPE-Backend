// The leaves a level change touches, and whether a merchant's declaration covers them (feature 036,
// FR-007).
//
// **This is the case that decides whether the feature is correct.** Publishing a level has to know which
// experiments it reaches, and a merchant is out of reach only if what it declares already wins for
// everything that changed. Read by **field** instead of by **leaf**, a merchant that declares one key of an
// object would look covered for the whole object — and its measurement window would keep running over a
// treatment that changed. That is the expensive mistake, and the third case here is the only one that
// distinguishes the two readings.
//
// Six of the ten treatment fields merge key by key (`PolicyInput.merge`) and `decisionPolicy.evidence`
// one level deeper still, which is why the unit is the leaf.
import { describe, expect, it } from "vitest";
import { ChangedLeaves } from "../../../../src/domain/configuration/index.js";

describe("ChangedLeaves.between", () => {
  it("finds nothing between two identical contents", () => {
    const content = { holdoutShare: 0, decisionPolicy: { threshold: 0.6, priority: ["fit", "price"] } };
    expect(ChangedLeaves.between(content, { ...content }).paths()).toEqual([]);
    expect(ChangedLeaves.between(content, { ...content }).none()).toBe(true);
  });

  it("names the leaf and not the object that contains it", () => {
    const leaves = ChangedLeaves.between(
      { decisionPolicy: { threshold: 0.6, readingSeconds: 20 } },
      { decisionPolicy: { threshold: 0.7, readingSeconds: 20 } },
    );
    expect(leaves.paths()).toEqual(["decisionPolicy.threshold"]);
  });

  it("goes as deep as the merge does", () => {
    // `decisionPolicy.evidence` merges one level deeper than the rest, so a leaf inside it is a leaf of
    // its own and not the whole `evidence`.
    const leaves = ChangedLeaves.between(
      { decisionPolicy: { evidence: { returnsPolicy: true, fitData: true } } },
      { decisionPolicy: { evidence: { returnsPolicy: false, fitData: true } } },
    );
    expect(leaves.paths()).toEqual(["decisionPolicy.evidence.returnsPolicy"]);
  });

  it("treats an array as one leaf, because declaring it replaces it whole", () => {
    const leaves = ChangedLeaves.between({ barriers: ["fit", "price"] }, { barriers: ["fit"] });
    expect(leaves.paths()).toEqual(["barriers"]);
  });

  it("names a leaf that appears and one that disappears", () => {
    expect(ChangedLeaves.between({ a: 1 }, { a: 1, b: 2 }).paths()).toEqual(["b"]);
    expect(ChangedLeaves.between({ a: 1, b: 2 }, { a: 1 }).paths()).toEqual(["b"]);
  });
});

// **The array of objects is the shape this level actually has**, and the gate found it uncovered: the
// decision rules and the return-risk conditions are arrays of objects, so comparing two of them is the
// ordinary case and not an edge. An array is one leaf, so the whole comparison happens inside the canonical
// text of that leaf — which is the only place in this type where two values can be equal while looking
// different, or different while looking equal.
describe("ChangedLeaves.between, over the arrays of objects this level is made of", () => {
  const ruleOf = (block: string, strength = "strong") => ({
    id: "price.price-read",
    barrier: "price",
    strength,
    when: { fact: "dwellSeconds", block },
  });

  it("sees a value that changed inside an object inside an array", () => {
    const leaves = ChangedLeaves.between(
      { decisionPolicy: { rules: [ruleOf("price")] } },
      { decisionPolicy: { rules: [ruleOf("policies")] } },
    );
    expect(leaves.paths()).toEqual(["decisionPolicy.rules"]);
  });

  it("does not see a change when only the key order differs", () => {
    // Two identical rule sets written in a different order are the same treatment, and a publication that
    // called them different would create a version and restart every measurement window for nothing.
    const leaves = ChangedLeaves.between(
      { rules: [{ id: "a", barrier: "price", when: { fact: "dwellSeconds", block: "price" } }] },
      { rules: [{ when: { block: "price", fact: "dwellSeconds" }, barrier: "price", id: "a" }] },
    );
    expect(leaves.none()).toBe(true);
  });

  it("does not see a change when a key inside is declared as undefined rather than absent", () => {
    // An absent key and a key holding `undefined` resolve the same way, so they are the same content.
    const leaves = ChangedLeaves.between(
      { rules: [{ id: "a", strength: undefined }] },
      { rules: [{ id: "a" }] },
    );
    expect(leaves.none()).toBe(true);
  });

  it("sees the difference between an array holding an undefined and an empty one", () => {
    // What the guard of `canonical` is for: an element that is `undefined` is still an element, and an
    // array of one is not an array of none. Without it both would canonicalise to the same text.
    expect(ChangedLeaves.between({ a: [undefined] }, { a: [] }).paths()).toEqual(["a"]);
  });

  it("sees a rule added to the list and a rule taken out of it", () => {
    const one = { rules: [ruleOf("price")] };
    const two = { rules: [ruleOf("price"), ruleOf("policies")] };
    expect(ChangedLeaves.between(one, two).paths()).toEqual(["rules"]);
    expect(ChangedLeaves.between(two, one).paths()).toEqual(["rules"]);
  });
});

describe("ChangedLeaves.under", () => {
  // Not every value of a level is treatment: level 1 holds five fields that decide what is counted and five
  // that are operational, so the question «who does this change reach» is asked of a subset of the paths.
  const changed = ChangedLeaves.between(
    { dedupWindow: { ttlMs: 1 }, retryAfterSeconds: 5 },
    { dedupWindow: { ttlMs: 2 }, retryAfterSeconds: 9 },
  );

  it("keeps the leaves under one of the fields and drops the rest", () => {
    expect(changed.under(["dedupWindow"]).paths()).toEqual(["dedupWindow.ttlMs"]);
    expect(changed.under(["retryAfterSeconds"]).paths()).toEqual(["retryAfterSeconds"]);
  });

  it("is empty when nothing that changed is under one of them, and whole when everything is", () => {
    expect(changed.under(["visitorWindowMs"]).none()).toBe(true);
    expect(changed.under(["dedupWindow", "retryAfterSeconds"]).paths()).toEqual(changed.paths());
  });

  it("matches by the first segment, so a field takes everything under it", () => {
    // By full path a nested leaf would never match the name of its field, and the whole subset would be
    // empty for every object-valued field — which is most of level 1.
    const deep = ChangedLeaves.between({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } });
    expect(deep.under(["a"]).paths()).toEqual(["a.b.c"]);
    expect(deep.under(["a.b"]).none()).toBe(true);
  });
});

describe("ChangedLeaves.coveredBy", () => {
  const leaves = (from: object, to: object) => ChangedLeaves.between(from, to);

  it("is covered when the merchant declares every leaf that changed", () => {
    const changed = leaves({ holdoutShare: 0 }, { holdoutShare: 0.2 });
    expect(changed.coveredBy({ holdoutShare: 0.5 })).toBe(true);
  });

  it("is not covered when the merchant declares nothing", () => {
    const changed = leaves({ holdoutShare: 0 }, { holdoutShare: 0.2 });
    expect(changed.coveredBy({})).toBe(false);
  });

  it("**is not covered when the merchant declares one leaf of an object and not the other**", () => {
    // The case that separates reading by leaf from reading by field. `threshold` and `readingSeconds` both
    // changed; the merchant declares only `threshold`, so `readingSeconds` still resolves from the level
    // that changed and its treatment **did** change. By field, this merchant would look covered.
    const changed = leaves(
      { decisionPolicy: { threshold: 0.6, readingSeconds: 20 } },
      { decisionPolicy: { threshold: 0.7, readingSeconds: 30 } },
    );
    expect(changed.paths()).toEqual(["decisionPolicy.readingSeconds", "decisionPolicy.threshold"]);
    expect(changed.coveredBy({ decisionPolicy: { threshold: 0.9 } })).toBe(false);
    // Declaring both leaves does cover it.
    expect(changed.coveredBy({ decisionPolicy: { threshold: 0.9, readingSeconds: 45 } })).toBe(true);
  });

  it("does not accept the container as a declaration of its leaves", () => {
    // Declaring `decisionPolicy` as an empty object declares no leaf: the merge copies key by key, so
    // nothing of the merchant wins and the default that changed still governs.
    const changed = leaves({ decisionPolicy: { threshold: 0.6 } }, { decisionPolicy: { threshold: 0.7 } });
    expect(changed.coveredBy({ decisionPolicy: {} })).toBe(false);
  });

  it("ignores a declaration of something that did not change", () => {
    const changed = leaves({ holdoutShare: 0 }, { holdoutShare: 0.2 });
    expect(changed.coveredBy({ barriers: ["fit"] })).toBe(false);
  });

  it("is covered by anyone when nothing changed, which is what keeps a repeated publication quiet", () => {
    expect(leaves({ a: 1 }, { a: 1 }).coveredBy({})).toBe(true);
  });
});
