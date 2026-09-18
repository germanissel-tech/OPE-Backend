// Experiment (01-arquitectura-mvp.md §4.1, §14.2; ADR-022, ADR-024): one per merchant may be
// active. Seed and split are immutable: changing them is a new experiment with another
// identifier. The assignment is not a feature flag: nobody changes a visitor's arm. An
// Experiment only exists valid: `of` enforces the rules, `rehydrate` trusts recorded facts.
import {
  fail,
  ok,
  type Arm,
  type ExperimentId,
  type MerchantId,
  type Result,
  type VisitorId,
} from "../shared-kernel/index.js";
import { InvalidSeed, InvalidTreatmentShare, type ExperimentError } from "./errors.js";

export type ExperimentStatus = "active" | "closed";

/** The facts of an experiment, as configuration or a store describes them. */
export interface ExperimentRecord {
  experimentId: ExperimentId;
  merchantId: MerchantId;
  /** Share of visitors assigned to TREATMENT, as a rate 0..1 (percentages stay at the edge). */
  treatmentShare: number;
  /** Part of the assignment key; immutable. */
  seed: string;
  status: ExperimentStatus;
  startedAt: Date;
}

/** Unit separator: no field can imitate another inside the key. */
const ASSIGNMENT_KEY_SEPARATOR = "";
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const PERCENT_BUCKETS = 100;

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

export class Experiment {
  readonly experimentId: ExperimentId;
  readonly merchantId: MerchantId;
  readonly treatmentShare: number;
  readonly seed: string;
  readonly status: ExperimentStatus;
  readonly startedAt: Date;

  private constructor(record: ExperimentRecord) {
    this.experimentId = record.experimentId;
    this.merchantId = record.merchantId;
    this.treatmentShare = record.treatmentShare;
    this.seed = record.seed;
    this.status = record.status;
    this.startedAt = record.startedAt;
  }

  /** A new experiment: the rules of creation apply. */
  static of(input: ExperimentRecord): Result<Experiment, ExperimentError> {
    const { treatmentShare, seed } = input;
    if (!Number.isFinite(treatmentShare) || treatmentShare < 0 || treatmentShare > 1) {
      return fail(new InvalidTreatmentShare(treatmentShare));
    }
    if (seed === "") return fail(new InvalidSeed());
    return ok(new Experiment(input));
  }

  /** An experiment already recorded: its facts are not re-judged. */
  static rehydrate(record: ExperimentRecord): Experiment {
    return new Experiment(record);
  }

  isActive(): boolean {
    return this.status === "active";
  }

  /**
   * The arm of a visitor: bucket 0..99 of the key against the treatment share (ADR-022). Pure and
   * stable. The split resolves to whole buckets (1 %): the share is rounded to a bucket count,
   * which also keeps `n / 100` exact for every integer percentage (7 / 100 * 100 is not 7 in
   * floating point; Math.round(7 / 100 * 100) is).
   */
  assign(visitorId: VisitorId): Arm {
    const key = [this.merchantId, this.experimentId, this.seed, visitorId].join(ASSIGNMENT_KEY_SEPARATOR);
    const bucket = fnv1a32(key) % PERCENT_BUCKETS;
    return bucket < Math.round(this.treatmentShare * PERCENT_BUCKETS) ? "TREATMENT" : "CONTROL";
  }
}
