// How far a platform signature's timestamp may sit from the server clock, either way (ADR-029):
// the clock skew every instant a client declares is allowed (shared-kernel), declared here as
// the policy the verifier applies.
import { CLOCK_SKEW_TOLERANCE_MS } from "../../../domain/shared-kernel/index.js";

export const SIGNATURE_WINDOW_MS = CLOCK_SKEW_TOLERANCE_MS;
