// ADR-024; feature 017 US3 (03 §4.10, D-G): an Experiment only exists valid — split, seed, target
// sample and cuts judged at creation — and moves through calibration, activity and closure by its
// own rules; rehydrate trusts recorded facts; assign does not change.
import { describe, expect, it } from "vitest";
import {
  Experiment,
  InvalidExperimentCuts,
  InvalidSeed,
  InvalidTargetSample,
  InvalidTreatmentShare,
  TreatmentExceedsHoldout,
  TreatmentShareTooFine,
  type ExperimentInput,
} from "../../../../src/domain/experiment/index.js";
import { asExperimentId, asMerchantId } from "../../../../src/domain/shared-kernel/index.js";
import { experimentRecord } from "../../../helpers/experiments.js";

const OPENED = new Date("2026-09-17T00:00:00.000Z");
const LATER = new Date("2026-09-20T00:00:00.000Z");
const EVEN_LATER = new Date("2026-09-25T00:00:00.000Z");

const input = (over: Partial<ExperimentInput> = {}): ExperimentInput => ({
  experimentId: asExperimentId("exp_00000001"),
  merchantId: asMerchantId("m_a"),
  treatmentShare: 0.5,
  seed: "seed-alpha",
  targetSample: 32_000,
  cuts: [0.33, 0.66],
  openedAt: OPENED,
  ...over,
});

function opened(over: Partial<ExperimentInput> = {}): Experiment {
  const built = Experiment.of(input(over));
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

describe("Experiment.of", () => {
  it("opens in calibration with every fact, no instant but the opening and no restart", () => {
    for (const treatmentShare of [0, 0.5, 1]) {
      const built = Experiment.of(input({ treatmentShare }));
      expect(built.ok).toBe(true);
      if (!built.ok) continue;
      expect(built.value.record()).toEqual({
        ...input({ treatmentShare }),
        status: "calibrating",
        activatedAt: undefined,
        windowStartedAt: undefined,
        closedAt: undefined,
        windowRestarts: [],
      });
      expect(built.value.isOpen()).toBe(true);
      expect(built.value.isActive()).toBe(false);
      expect(built.value.phase()).toBe("calibration");
    }
  });

  // The share is judged by the kernel's `isRate` (015 F-030); its table of edges lives in
  // shared-kernel/rate.test.ts. One case here: the rejection names the share.
  it("[invariant] a share outside 0..1 is rejected", () => {
    const built = Experiment.of(input({ treatmentShare: 1.5 }));
    expect(built).toMatchObject({
      ok: false,
      error: { code: "invalid-treatment-share", module: "experiment", details: { share: 1.5 } },
    });
    if (!built.ok) expect(built.error).toBeInstanceOf(InvalidTreatmentShare);
  });

  // Feature 023: the rule the whole feature exists for. Before it, a share the split could not
  // hand out was rounded to the nearest bucket without saying so, and `0.004` opened an experiment
  // that assigned nobody.
  it("[invariant] a share the split cannot hand out is rejected, and the hundred and one it can are not", () => {
    // Both ways the value can reach the domain: computed, and parsed from the JSON literal a client
    // writes. If any of the 101 is rejected, the rule is being judged by division — see research R-01.
    const computed = Array.from({ length: 101 }, (_, n) => n / 100);
    const parsed = JSON.parse(`[${computed.map((s) => s.toFixed(2)).join(",")}]`) as number[];
    for (const share of [...computed, ...parsed]) {
      expect(Experiment.of(input({ treatmentShare: share })).ok, String(share)).toBe(true);
    }

    // A share finer than a bucket: the five of SC-001, plus the noise of an addition, which is
    // refused like any other because accepting it would be rounding in silence.
    for (const share of [0.004, 0.005, 0.075, 0.999, 0.12345, 0.1 + 0.2]) {
      const built = Experiment.of(input({ treatmentShare: share }));
      expect(built, String(share)).toMatchObject({
        ok: false,
        error: { code: "treatment-share-too-fine", module: "experiment", details: { share } },
      });
      if (!built.ok) expect(built.error).toBeInstanceOf(TreatmentShareTooFine);
    }

    // Writing a decimal does not produce that noise: these three are one and the same number.
    expect([0.07, 0.070000000000000007, 7 / 100].every((s) => Experiment.handsOut(s))).toBe(true);
  });

  it("a share out of range is out of range, not too fine: the order of the two rules holds", () => {
    // 1.5 rounds to 150 buckets, so the round trip would also refuse it. The range answers first.
    expect(Experiment.of(input({ treatmentShare: 1.5 })).ok ? undefined : "checked").toBe("checked");
    const built = Experiment.of(input({ treatmentShare: 1.5 }));
    expect(built).toMatchObject({ ok: false, error: { code: "invalid-treatment-share" } });
  });

  // Feature 023: the cuts are fractions of the target sample and nobody resolves them to buckets,
  // so the split's rule does not reach them. Extending it "for consistency" would refuse a cut at
  // an eighth of the sample, which is perfectly readable.
  it("the cuts are not the split: a finer fraction is valid", () => {
    expect(Experiment.of(input({ cuts: [0.125, 0.3333, 0.875] })).ok).toBe(true);
    expect(Experiment.handsOut(0.125)).toBe(false);
  });

  it("[invariant] an empty seed is rejected", () => {
    const built = Experiment.of(input({ seed: "" }));
    expect(built).toMatchObject({ ok: false, error: { code: "invalid-seed" } });
    if (!built.ok) expect(built.error).toBeInstanceOf(InvalidSeed);
  });

  it("[invariant:invalid-target-sample] the target sample is a whole number of at least one visitor", () => {
    for (const targetSample of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const built = Experiment.of(input({ targetSample }));
      expect(built, String(targetSample)).toMatchObject({
        ok: false,
        error: { code: "invalid-target-sample", details: { targetSample } },
      });
      if (!built.ok) expect(built.error).toBeInstanceOf(InvalidTargetSample);
    }
    expect(Experiment.of(input({ targetSample: 1 })).ok).toBe(true);
  });

  it("[invariant:invalid-experiment-cuts] the cuts are strictly increasing fractions of 1, naming the first offender", () => {
    const cases: [number[], number][] = [
      [[0.66, 0.33], 1],
      [[0.33, 0.33], 1],
      [[0, 0.5], 0],
      [[0.5, 1.01], 1],
      [[0.33, Number.NaN], 1],
    ];
    for (const [cuts, index] of cases) {
      const built = Experiment.of(input({ cuts }));
      expect(built, JSON.stringify(cuts)).toMatchObject({
        ok: false,
        error: { code: "invalid-experiment-cuts", details: { index } },
      });
      if (!built.ok) expect(built.error).toBeInstanceOf(InvalidExperimentCuts);
    }
    for (const cuts of [[], [0.01], [1], [0.01, 0.5, 1], [0.33, 0.66, 1]]) {
      expect(Experiment.of(input({ cuts })).ok, JSON.stringify(cuts)).toBe(true);
    }
  });

  it("rehydrate does not re-judge: a recorded share out of range comes back as recorded", () => {
    expect(Experiment.rehydrate(experimentRecord({ treatmentShare: 2 })).treatmentShare).toBe(2);
    expect(Experiment.rehydrate(experimentRecord({ cuts: [0.66, 0.33] })).cuts).toEqual([0.66, 0.33]);
  });
});

describe("Experiment.withinHoldout", () => {
  it("[invariant:treatment-exceeds-holdout] the split may not take what the holdout keeps out, compared in whole buckets", () => {
    const fits = opened({ treatmentShare: 0.95 }).withinHoldout(0.05);
    expect(fits.ok).toBe(true);
    expect(opened({ treatmentShare: 1 }).withinHoldout(0).ok).toBe(true);
    expect(opened({ treatmentShare: 0 }).withinHoldout(1).ok).toBe(true);
    const exceeds = opened({ treatmentShare: 0.96 }).withinHoldout(0.05);
    expect(exceeds).toMatchObject({
      ok: false,
      error: { code: "treatment-exceeds-holdout", details: { treatmentShare: 0.96, holdoutShare: 0.05 } },
    });
    if (!exceeds.ok) expect(exceeds.error).toBeInstanceOf(TreatmentExceedsHoldout);
    // 0.7 + 0.3 is not 1 in floating point; in buckets it is.
    expect(opened({ treatmentShare: 0.7 }).withinHoldout(0.3).ok).toBe(true);
    expect(opened({ treatmentShare: 0.71 }).withinHoldout(0.3).ok).toBe(false);
  });
});

describe("Experiment transitions (03 §4.10)", () => {
  it("activated from calibration: active, the window starts at that instant, the phase is accumulation", () => {
    const active = opened().activated(LATER);
    if (!active.ok) throw new Error(active.error.message);
    expect(active.value.record()).toMatchObject({
      status: "active",
      openedAt: OPENED,
      activatedAt: LATER,
      windowStartedAt: LATER,
      closedAt: undefined,
    });
    expect(active.value.isOpen()).toBe(true);
    expect(active.value.isActive()).toBe(true);
    expect(active.value.phase()).toBe("accumulation");
  });

  it("activated again: the same experiment, the window untouched", () => {
    const active = opened().activated(LATER);
    if (!active.ok) throw new Error(active.error.message);
    const again = active.value.activated(EVEN_LATER);
    expect(again.ok && again.value).toBe(active.value);
  });

  it("[invariant] a closed experiment cannot be activated (experiment-not-open)", () => {
    const closed = opened().closed(LATER);
    expect(closed.activated(EVEN_LATER)).toMatchObject({
      ok: false,
      error: { code: "experiment-not-open", module: "experiment" },
    });
  });

  it("closed from calibration or from activity: terminal, the phase stays accumulation, closing again changes nothing", () => {
    const fromCalibration = opened().closed(LATER);
    expect(fromCalibration.record()).toMatchObject({
      status: "closed",
      activatedAt: undefined,
      windowStartedAt: undefined,
      closedAt: LATER,
    });
    expect(fromCalibration.isOpen()).toBe(false);
    expect(fromCalibration.isActive()).toBe(false);
    expect(fromCalibration.phase()).toBe("accumulation");
    const active = opened().activated(LATER);
    if (!active.ok) throw new Error(active.error.message);
    const fromActivity = active.value.closed(EVEN_LATER);
    expect(fromActivity.record()).toMatchObject({
      status: "closed",
      activatedAt: LATER,
      windowStartedAt: LATER,
      closedAt: EVEN_LATER,
    });
    expect(fromActivity.closed(new Date("2026-10-01T00:00:00.000Z"))).toBe(fromActivity);
  });

  it("windowRestarted: only while active; the window moves and the restart is kept in order", () => {
    const active = opened().activated(LATER);
    if (!active.ok) throw new Error(active.error.message);
    const once = active.value.windowRestarted(EVEN_LATER, "anchor fix", 3);
    if (!once.ok) throw new Error(once.error.message);
    expect(once.value.record()).toMatchObject({
      status: "active",
      activatedAt: LATER,
      windowStartedAt: EVEN_LATER,
      windowRestarts: [{ at: EVEN_LATER, reason: "anchor fix", configurationVersion: 3 }],
    });
    const final = new Date("2026-10-01T00:00:00.000Z");
    const twice = once.value.windowRestarted(final, "margin", 4);
    expect(twice.ok && twice.value.windowRestarts).toEqual([
      { at: EVEN_LATER, reason: "anchor fix", configurationVersion: 3 },
      { at: final, reason: "margin", configurationVersion: 4 },
    ]);
    expect(twice.ok && twice.value.windowStartedAt).toBe(final);
    expect(active.value.windowRestarts).toEqual([]);
    expect(opened().windowRestarted(LATER, "x", 1)).toMatchObject({
      ok: false,
      error: { code: "experiment-not-open" },
    });
    expect(active.value.closed(final).windowRestarted(final, "x", 1)).toMatchObject({
      ok: false,
      error: { code: "experiment-not-open" },
    });
  });

  it("the arm of a visitor does not depend on the state: calibrating, active and closed assign alike", () => {
    const calibrating = opened();
    const active = calibrating.activated(LATER);
    if (!active.ok) throw new Error(active.error.message);
    const closed = active.value.closed(EVEN_LATER);
    for (let n = 1; n <= 50; n += 1) {
      const visitor = `vis_${String(n).padStart(8, "0")}`;
      const arm = calibrating.assign(visitor as never);
      expect(active.value.assign(visitor as never)).toBe(arm);
      expect(closed.assign(visitor as never)).toBe(arm);
    }
  });
});
