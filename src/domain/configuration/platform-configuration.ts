// Level 1 of the configuration (constitution XI; ADR-031): the values of the platform that no
// merchant overrides. They travel with the release (`config/platform.json`), are read at
// start-up and change with a deploy, never in flight: a hot change would contaminate every
// active experiment. Windows are milliseconds; budgets are counts.
import { fail, ok, type Result } from "../shared-kernel/index.js";
import { InvalidConfigurationValue } from "./errors.js";

export interface DedupWindowRecord {
  /** Ids older than this are forgotten. */
  ttlMs: number;
  /** Ids kept per merchant at most; the oldest go first. */
  maxIds: number;
}

export interface PlatformConfigurationRecord {
  version: string;
  dedupWindow: DedupWindowRecord;
  /** How far into the future an instant a client declares may sit. */
  clockSkewToleranceMs: number;
  /** How far into the past an event instant may sit (late uploads). */
  eventPastToleranceMs: number;
  sessionWindowMs: number;
  visitorWindowMs: number;
  signatureWindowMs: number;
  rotationGraceMaxMs: number;
  anchorDiagnosticsKept: number;
  unmappedValuesKept: number;
  /** Seconds a client waits before retrying a write a store could not accept (ADR-021): the `Retry-After` of every 503. */
  retryAfterSeconds: number;
}

const POSITIVE_PROBLEM = "must be a positive integer";
/** A whole number of at least zero: the platform counts and windows are integers. */
const isWhole = (value: number): boolean => Number.isInteger(value) && value >= 0;
/** The fields that must be positive, and the ones that may be zero. */
const POSITIVE = ["sessionWindowMs", "visitorWindowMs", "signatureWindowMs", "eventPastToleranceMs"] as const;
const NON_NEGATIVE = ["clockSkewToleranceMs", "rotationGraceMaxMs"] as const;

export class PlatformConfiguration {
  readonly version: string;
  readonly dedupWindow: DedupWindowRecord;
  readonly clockSkewToleranceMs: number;
  readonly eventPastToleranceMs: number;
  readonly sessionWindowMs: number;
  readonly visitorWindowMs: number;
  readonly signatureWindowMs: number;
  readonly rotationGraceMaxMs: number;
  readonly anchorDiagnosticsKept: number;
  readonly unmappedValuesKept: number;
  readonly retryAfterSeconds: number;

  private constructor(record: PlatformConfigurationRecord) {
    this.version = record.version;
    this.dedupWindow = { ...record.dedupWindow };
    this.clockSkewToleranceMs = record.clockSkewToleranceMs;
    this.eventPastToleranceMs = record.eventPastToleranceMs;
    this.sessionWindowMs = record.sessionWindowMs;
    this.visitorWindowMs = record.visitorWindowMs;
    this.signatureWindowMs = record.signatureWindowMs;
    this.rotationGraceMaxMs = record.rotationGraceMaxMs;
    this.anchorDiagnosticsKept = record.anchorDiagnosticsKept;
    this.unmappedValuesKept = record.unmappedValuesKept;
    this.retryAfterSeconds = record.retryAfterSeconds;
  }

  /** A named version and every value in its range; the first offence names its field. */
  static of(record: PlatformConfigurationRecord): Result<PlatformConfiguration, InvalidConfigurationValue> {
    if (record.version.trim() === "")
      return fail(new InvalidConfigurationValue("version", "must not be empty"));
    if (!isWhole(record.dedupWindow.ttlMs) || record.dedupWindow.ttlMs < 1) {
      return fail(new InvalidConfigurationValue("dedupWindow.ttlMs", POSITIVE_PROBLEM));
    }
    if (!isWhole(record.dedupWindow.maxIds) || record.dedupWindow.maxIds < 1) {
      return fail(new InvalidConfigurationValue("dedupWindow.maxIds", POSITIVE_PROBLEM));
    }
    for (const field of POSITIVE) {
      if (!isWhole(record[field]) || record[field] < 1) {
        return fail(new InvalidConfigurationValue(field, POSITIVE_PROBLEM));
      }
    }
    for (const field of NON_NEGATIVE) {
      if (!isWhole(record[field]))
        return fail(new InvalidConfigurationValue(field, "must be a non-negative integer"));
    }
    if (!isWhole(record.unmappedValuesKept) || record.unmappedValuesKept < 1) {
      return fail(new InvalidConfigurationValue("unmappedValuesKept", POSITIVE_PROBLEM));
    }
    if (!isWhole(record.anchorDiagnosticsKept) || record.anchorDiagnosticsKept < 1) {
      return fail(new InvalidConfigurationValue("anchorDiagnosticsKept", POSITIVE_PROBLEM));
    }
    if (!isWhole(record.retryAfterSeconds) || record.retryAfterSeconds < 1) {
      return fail(new InvalidConfigurationValue("retryAfterSeconds", POSITIVE_PROBLEM));
    }
    return ok(new PlatformConfiguration(record));
  }

  static rehydrate(record: PlatformConfigurationRecord): PlatformConfiguration {
    return new PlatformConfiguration(record);
  }

  /**
   * How many identities one instance keeps in memory at most: event ids, sessions and visitors
   * share it on purpose, because it is a single bound of the process and not three policies
   * (constitution IV, ADR-034). The day the hot state leaves the process, separating them is a
   * new field of this level, not a change of shape.
   */
  identityCap(): number {
    return this.dedupWindow.maxIds;
  }

  record(): PlatformConfigurationRecord {
    return {
      version: this.version,
      dedupWindow: { ...this.dedupWindow },
      clockSkewToleranceMs: this.clockSkewToleranceMs,
      eventPastToleranceMs: this.eventPastToleranceMs,
      sessionWindowMs: this.sessionWindowMs,
      visitorWindowMs: this.visitorWindowMs,
      signatureWindowMs: this.signatureWindowMs,
      rotationGraceMaxMs: this.rotationGraceMaxMs,
      anchorDiagnosticsKept: this.anchorDiagnosticsKept,
      unmappedValuesKept: this.unmappedValuesKept,
      retryAfterSeconds: this.retryAfterSeconds,
    };
  }
}
