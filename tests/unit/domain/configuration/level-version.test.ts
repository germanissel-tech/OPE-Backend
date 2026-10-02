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

  it("asks for the three things apart: the flag alone and the reason alone each make it another version", () => {
    // **One case that changes both fields proves neither.** With the same values and the same reason, a
    // draft that is no longer corrective is a different publication — and the other way round — so each of
    // the two comparisons needs a case where it is the only thing that differs.
    const corrective = numbered({ corrective: true, reason: "the holdout was wrong" });
    expect(corrective.sameContentAs(draft({ corrective: false, reason: "the holdout was wrong" }))).toBe(
      false,
    );
    expect(corrective.sameContentAs(draft({ corrective: true, reason: "something else" }))).toBe(false);
    // And with the three equal it repeats, which is what makes an identical body answer 200.
    expect(corrective.sameContentAs(draft({ corrective: true, reason: "the holdout was wrong" }))).toBe(true);
  });

  it("answers which leaves a draft would change against it", () => {
    const version = numbered({ content: { decisionPolicy: { threshold: 0.6, readingSeconds: 20 } } });
    const changed = version.changedLeaves(
      draft({ content: { decisionPolicy: { threshold: 0.7, readingSeconds: 20 } } }),
    );
    expect(changed.paths()).toEqual(["decisionPolicy.threshold"]);
  });

  it("**asks the measurement only about the fields that govern it, and that depends on the level**", () => {
    // The distinction US3 rests on: the whole of level 2 is treatment, and level 1 is not. A publication that
    // only moves the `Retry-After` reaches nobody, so it is not frozen by a running experiment and restarts
    // no window; one that moves the duration of a session changes what is counted and does both.
    const operational = { content: { retryAfterSeconds: 5, visitorWindowMs: 10 } };
    const platform = LevelVersion.numbered(draft({ level: "platform", ...operational }), 1);
    const sameButRetry = draft({ level: "platform", content: { retryAfterSeconds: 9, visitorWindowMs: 10 } });
    const sameButWindow = draft({
      level: "platform",
      content: { retryAfterSeconds: 5, visitorWindowMs: 20 },
    });

    expect(platform.changedLeaves(sameButRetry).paths()).toEqual(["retryAfterSeconds"]);
    expect(platform.measuringLeaves(sameButRetry).none()).toBe(true);
    expect(platform.measuringLeaves(sameButWindow).paths()).toEqual(["visitorWindowMs"]);

    // Of level 2 every leaf measures, so the two answers are the same one.
    const defaults = LevelVersion.numbered(draft({ content: { holdoutShare: 0 } }), 1);
    const other = draft({ content: { holdoutShare: 0.2 } });
    expect(defaults.measuringLeaves(other).paths()).toEqual(defaults.changedLeaves(other).paths());
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
