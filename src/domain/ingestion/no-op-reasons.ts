// Catalogue of NO_OP reasons: replica of contracts/no-op-reasons.yaml (the source); a test
// verifies they match. Adding a reason is compatible (the contract declares it as a string).
export const NO_OP_REASONS = ["decision-plane-unavailable", "page-context-incomplete"] as const;
export type NoOpReason = (typeof NO_OP_REASONS)[number];
