// Assignment (constitution III; ADR-022): a pure function of merchant, experiment, seed and
// visitor. The same input gives the same arm on any instance, without shared state. FNV-1a 32
// bits, verified on 100 000 visitors (random and sequential ids): within 0.3 pp of the target
// split, independent between merchants (specs/007-asignacion-experimental/research.md R-01).
import type { Experiment } from "./experiment.js";
import type { Arm, ExperimentId, MerchantId, VisitorId } from "../shared-kernel/index.js";

export interface Assignment {
  merchantId: MerchantId;
  experimentId: ExperimentId;
  visitorId: VisitorId;
  arm: Arm;
  assignedAt: Date;
}

/** Unit separator: no field can imitate another inside the key. */
const ASSIGNMENT_KEY_SEPARATOR = "\u001f";

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const PERCENT_BUCKETS = 100;

/** 32-bit FNV-1a of the UTF-16 code units of `text`; deterministic and dependency-free. */
export function fnv1a32(text: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

export function assignmentKey(experiment: Experiment, visitorId: VisitorId): string {
  return [experiment.merchantId, experiment.experimentId, experiment.seed, visitorId].join(
    ASSIGNMENT_KEY_SEPARATOR,
  );
}

/** The arm of a visitor in an experiment: bucket 0..99 of the key against the treatment share. */
export function assignArm(experiment: Experiment, visitorId: VisitorId): Arm {
  const bucket = fnv1a32(assignmentKey(experiment, visitorId)) % PERCENT_BUCKETS;
  return bucket < experiment.treatmentPercent ? "TREATMENT" : "CONTROL";
}
