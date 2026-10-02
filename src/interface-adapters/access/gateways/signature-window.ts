// How far a platform signature's timestamp may sit from the server clock, either way (ADR-029;
// level 1 of the configuration). It takes a **reader** of the value, not the configuration entity: a gateway
// of this module knows nothing of the configuration module, and a level is read when it is used.
import type { SignatureWindow } from "../../../application/access/index.js";

export function signatureWindowOf(windowMs: () => number): SignatureWindow {
  return { windowMs };
}
