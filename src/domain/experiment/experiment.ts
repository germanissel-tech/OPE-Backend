import {
  fail,
  isRate,
  ok,
  type Arm,
  type ExperimentId,
  type MerchantId,
  type Result,
  type VisitorId,
} from "../shared-kernel/index.js";
import {
  ExperimentNotOpen,
  InvalidExperimentCuts,
  InvalidSeed,
  InvalidTargetSample,
  InvalidTreatmentShare,
  TreatmentExceedsHoldout,
  type ExperimentError,
} from "./errors.js";

/**
 * The states of an experiment: `calibrating → active → closed`, or `calibrating → closed`
 * (03 §4.10, D-G). The list is the declaration and the type comes from it, the way the kernel
 * declares the barriers and the anchors: whoever has to enumerate the states —the reader of the
 * seed, to reject an unknown one— imports this and cannot fall behind it.
 */
export const EXPERIMENT_STATUSES = ["calibrating", "active", "closed"] as const;
export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];
const [CALIBRATING, ACTIVE, CLOSED] = EXPERIMENT_STATUSES;

/** What a decision taken under the experiment is for: nothing (calibration) or the analysis. */
export type ExperimentPhase = "calibration" | "accumulation";

/** A restart of the accumulation window: a corrective configuration version while active. */
export interface WindowRestart {
  at: Date;
  reason: string;
  configurationVersion: number;
}

/** What an operator declares to open an experiment; the instants and the state are the entity's. */
export interface ExperimentInput {
  experimentId: ExperimentId;
  merchantId: MerchantId;
  /** Share of visitors assigned to TREATMENT, as a fraction of 1: there is no other unit. */
  treatmentShare: number;
  /** Part of the assignment key; immutable. */
  seed: string;
  /** Visitors the accumulation window aims at; the last cut. */
  targetSample: number;
  /** Interim cuts as fractions of the target sample, strictly increasing (D-F). */
  cuts: readonly number[];
  openedAt: Date;
}

/** The facts of an experiment, as a store describes them. */
export interface ExperimentRecord extends ExperimentInput {
  status: ExperimentStatus;
  activatedAt?: Date | undefined;
  /** The activation or the last restart; the window in force. */
  windowStartedAt?: Date | undefined;
  closedAt?: Date | undefined;
  windowRestarts: readonly WindowRestart[];
}

/** Unit separator: no field can imitate another inside the key. */
const ASSIGNMENT_KEY_SEPARATOR = "\u001f";
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
/**
 * The resolution of the split: in how many buckets the population is divided to assign a visitor.
 * A hundred means buckets of one hundredth. It is **not** a conversion factor —there is no other
 * unit to convert to (feature 022)— and the day the split wants finer resolution this number
 * changes and nothing else does.
 */
const ASSIGNMENT_BUCKETS = 100;

/**
 * 32-bit FNV-1a of the UTF-16 code units of `text`; deterministic and dependency-free. Verified
 * on 100 000 visitors: within 0.3 pp of the target split, independent between merchants
 * (specs/007-asignacion-experimental/research.md R-01).
 */
function fnv1a32(text: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

/** A share; the lower bound is the cut before it (none: 0), which  enforces. */
const isCut = isRate;

/** The index of the first cut that is not a share above the previous one, or -1. */
function offendingCut(cuts: readonly number[]): number {
  let previous = 0;
  for (const [index, cut] of cuts.entries()) {
    if (!isCut(cut) || cut <= previous) return index;
    previous = cut;
  }
  return -1;
}

/** The share as whole buckets: the unit the assignment resolves to, and the one it is compared in. */
const bucketsOf = (share: number): number => Math.round(share * ASSIGNMENT_BUCKETS);

export class Experiment {
  readonly experimentId: ExperimentId;
  readonly merchantId: MerchantId;
  readonly treatmentShare: number;
  readonly seed: string;
  readonly targetSample: number;
  readonly cuts: readonly number[];
  readonly status: ExperimentStatus;
  readonly openedAt: Date;
  readonly activatedAt: Date | undefined;
  readonly windowStartedAt: Date | undefined;
  readonly closedAt: Date | undefined;
  readonly windowRestarts: readonly WindowRestart[];

  private constructor(record: ExperimentRecord) {
    this.experimentId = record.experimentId;
    this.merchantId = record.merchantId;
    this.treatmentShare = record.treatmentShare;
    this.seed = record.seed;
    this.targetSample = record.targetSample;
    this.cuts = [...record.cuts];
    this.status = record.status;
    this.openedAt = record.openedAt;
    this.activatedAt = record.activatedAt;
    this.windowStartedAt = record.windowStartedAt;
    this.closedAt = record.closedAt;
    this.windowRestarts = [...record.windowRestarts];
  }

  /** A new experiment, calibrating: the rules of creation apply. */
  static of(input: ExperimentInput): Result<Experiment, ExperimentError> {
    const { treatmentShare, seed, targetSample, cuts } = input;
    if (!isRate(treatmentShare)) return fail(new InvalidTreatmentShare(treatmentShare));
    if (seed === "") return fail(new InvalidSeed());
    if (!Number.isInteger(targetSample) || targetSample < 1)
      return fail(new InvalidTargetSample(targetSample));
    const offending = offendingCut(cuts);
    if (offending >= 0) return fail(new InvalidExperimentCuts(offending));
    return ok(new Experiment({ ...input, status: CALIBRATING, windowRestarts: [] }));
  }

  /** An experiment already recorded: its facts are not re-judged. */
  static rehydrate(record: ExperimentRecord): Experiment {
    return new Experiment(record);
  }

  record(): ExperimentRecord {
    return {
      experimentId: this.experimentId,
      merchantId: this.merchantId,
      treatmentShare: this.treatmentShare,
      seed: this.seed,
      targetSample: this.targetSample,
      cuts: this.cuts,
      status: this.status,
      openedAt: this.openedAt,
      activatedAt: this.activatedAt,
      windowStartedAt: this.windowStartedAt,
      closedAt: this.closedAt,
      windowRestarts: this.windowRestarts,
    };
  }

  /** Calibrating or active: it assigns and decides (03 §4.10). */
  isOpen(): boolean {
    return this.status !== CLOSED;
  }

  isActive(): boolean {
    return this.status === ACTIVE;
  }

  /** What a decision taken now is for: nothing while calibrating, the analysis once active. */
  phase(): ExperimentPhase {
    return this.status === CALIBRATING ? "calibration" : "accumulation";
  }

  /**
   * The split may not take what the holdout keeps out of OPE (feature 017): compared in whole
   * buckets, the unit the assignment resolves to.
   *
   * **In buckets and not in shares**, for two reasons. It compares what actually happens —the
   * effective split— and not what was asked for; and comparing shares would reject complementary
   * pairs that are legitimate, because `1 - 0.93` is `0.06999999999999995` in floating point, so a
   * split of `0.07` would read as above it (measured, feature 022).
   */
  withinHoldout(holdoutShare: number): Result<Experiment, TreatmentExceedsHoldout> {
    if (bucketsOf(this.treatmentShare) > ASSIGNMENT_BUCKETS - bucketsOf(holdoutShare)) {
      return fail(new TreatmentExceedsHoldout(this.treatmentShare, holdoutShare));
    }
    return ok(this);
  }

  /** Active from `now`: the accumulation window starts here. Already active, unchanged; closed, refused. */
  activated(now: Date): Result<Experiment, ExperimentNotOpen> {
    if (this.status === ACTIVE) return ok(this);
    if (this.status === CLOSED) return fail(new ExperimentNotOpen());
    return ok(new Experiment({ ...this.record(), status: ACTIVE, activatedAt: now, windowStartedAt: now }));
  }

  /** Closed at `now`, from calibration or activity; terminal. Already closed, unchanged. */
  closed(now: Date): Experiment {
    if (this.status === CLOSED) return this;
    return new Experiment({ ...this.record(), status: CLOSED, closedAt: now });
  }

  /**
   * The accumulation window restarts at `now` because a corrective configuration version was
   * published (D-G); only an active experiment has a window to restart.
   */
  windowRestarted(
    now: Date,
    reason: string,
    configurationVersion: number,
  ): Result<Experiment, ExperimentNotOpen> {
    if (this.status !== ACTIVE) return fail(new ExperimentNotOpen());
    const restart: WindowRestart = { at: now, reason, configurationVersion };
    return ok(
      new Experiment({
        ...this.record(),
        windowStartedAt: now,
        windowRestarts: [...this.windowRestarts, restart],
      }),
    );
  }

  /**
   * The arm of a visitor: bucket 0..99 of the key against the treatment share (ADR-022). Pure and
   * stable. The split resolves to whole buckets: the share is rounded to a bucket count, which is
   * also what keeps the arithmetic exact — `0.07 * 100` is not 7 in floating point, and
   * `Math.round(0.07 * 100)` is.
   */
  assign(visitorId: VisitorId): Arm {
    const key = [this.merchantId, this.experimentId, this.seed, visitorId].join(ASSIGNMENT_KEY_SEPARATOR);
    const bucket = fnv1a32(key) % ASSIGNMENT_BUCKETS;
    return bucket < bucketsOf(this.treatmentShare) ? "TREATMENT" : "CONTROL";
  }
}
