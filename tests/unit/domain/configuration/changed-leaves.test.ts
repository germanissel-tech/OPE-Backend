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
