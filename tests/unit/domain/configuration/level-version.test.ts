// A version of a level of the release (feature 036): the same thing a merchant configuration version
// already is, one level up — numbered by the store, immutable, and corrective only with its reason.
import { describe, expect, it } from "vitest";
import { LevelVersion, type LevelDraft } from "../../../../src/domain/configuration/index.js";
import { asOperatorId } from "../../../../src/domain/operator/index.js";

const AT = new Date("2026-09-30T12:00:00.000Z");

const draft = (over: Partial<LevelDraft> = {}): LevelDraft => ({
  level: "defaults",
  content: { holdoutShare: 0, decisionPolicy: { threshold: 0.6 } },
  corrective: false,
  publishedAt: AT,
  operatorId: asOperatorId("ops-all"),
  ...over,
});

describe("LevelVersion.draft", () => {
  it("accepts a draft that is not corrective and carries no reason", () => {
    expect(LevelVersion.draft(draft()).ok).toBe(true);
  });

  it("refuses a corrective draft without a reason, and one with a blank one", () => {
    // The reason is where the operator's awareness of what the change implies is written down; a corrective
    // version without it would be the decision without its record.
    const missing = LevelVersion.draft(draft({ corrective: true }));
    expect(missing.ok).toBe(false);
    expect(missing.ok ? undefined : missing.error.code).toBe("configuration-reason-required");
    expect(LevelVersion.draft(draft({ corrective: true, reason: "   " })).ok).toBe(false);
  });

  it("accepts a corrective draft with its reason", () => {
    expect(LevelVersion.draft(draft({ corrective: true, reason: "holdout before the pilot" })).ok).toBe(true);
  });
});

describe("LevelVersion", () => {
  const numbered = (over: Partial<LevelDraft> = {}, version = 1) =>
    LevelVersion.numbered(draft(over), version);

  it("takes the number from the store and keeps everything else", () => {
    const version = numbered({}, 7);
    expect(version.version).toBe(7);
    expect(version.level).toBe("defaults");
    expect(version.operatorId).toBe(asOperatorId("ops-all"));
    expect(version.publishedAt).toEqual(AT);
  });

  it("is the same content as a draft that declares the same thing, whatever the key order", () => {
    const version = numbered({ content: { a: 1, b: { c: 2, d: 3 } } });
    expect(version.sameContentAs(draft({ content: { b: { d: 3, c: 2 }, a: 1 } }))).toBe(true);
    expect(version.sameContentAs(draft({ content: { a: 1, b: { c: 2, d: 4 } } }))).toBe(false);
  });

  it("is not the same content when the reason or the corrective flag differ", () => {
    // Publishing the same values **with a reason** is not a repetition: it is a corrective version, and it
    // has consequences of its own on the measurement windows.
    const version = numbered();
    expect(version.sameContentAs(draft({ corrective: true, reason: "said out loud" }))).toBe(false);
  });

  it("answers which leaves a draft would change against it", () => {
    const version = numbered({ content: { decisionPolicy: { threshold: 0.6, readingSeconds: 20 } } });
    const changed = version.changedLeaves(
      draft({ content: { decisionPolicy: { threshold: 0.7, readingSeconds: 20 } } }),
    );
    expect(changed.paths()).toEqual(["decisionPolicy.threshold"]);
  });

  it("rehydrates what it recorded, without judging it again", () => {
    // A recorded version was judged when it was published (ADR-024): rehydration does not re-judge, which
    // is what lets a stored version survive a rule that later got stricter.
    const original = LevelVersion.numbered(draft({ corrective: true, reason: "why" }), 3);
    const record = original.record();
    const back = LevelVersion.rehydrate(record);
    expect(back.record()).toEqual(record);
    expect(back.reason).toBe("why");
    expect(back.version).toBe(3);
  });

  it("leaves the reason out of the record when there is none, instead of recording it as absent", () => {
    expect("reason" in numbered().record()).toBe(false);
  });
});
