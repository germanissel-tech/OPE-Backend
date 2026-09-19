// Public API of the selection module (domain): the candidates OPE may show, what a merchant
// declares it can sustain, and the quality gate that judges them (ADR-027).
export { ATTRIBUTE_CLAIM_PREFIX, CANDIDATES, STEPS } from "./candidate.js";
export type { Candidate, Claim, Step } from "./candidate.js";
export { EMPTY_PROFILE } from "./profile.js";
export type { MerchantProfile } from "./profile.js";
export { QualityGate } from "./quality-gate.js";
export type { GateEvidence, GateRejection, GateVerdict, Judged } from "./quality-gate.js";
