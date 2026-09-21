// The window of a platform signature (ADR-029; level 1 of the configuration, constitution XI):
// how far the timestamp a platform signs may sit from the server clock, either way.
export interface SignatureWindow {
  windowMs(): number;
}
