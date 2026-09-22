// The longest grace a credential rotation may give the previous credential (level 1 of the
// configuration, constitution XI). It takes the value, not the configuration entity: a gateway of
// this module knows nothing of the configuration module.
import type { RotationPolicy } from "../../../application/merchant/index.js";

export function rotationPolicyOf(maxGraceMs: number): RotationPolicy {
  return { maxGraceMs: () => Promise.resolve(maxGraceMs) };
}
