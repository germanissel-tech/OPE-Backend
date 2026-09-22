// How far a platform signature's timestamp may sit from the server clock, either way (ADR-029;
// level 1 of the configuration). It takes the value, not the configuration entity.
import type { SignatureWindow } from "../../../application/merchant/index.js";

export function signatureWindowOf(windowMs: number): SignatureWindow {
  return { windowMs: () => windowMs };
}
