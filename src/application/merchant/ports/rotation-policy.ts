// The platform's bound on a rotation grace (constitution XI, level platform): a read port the
// configuration module serves. Until the configuration levels exist (US2) the composition binds
// a fixed value.
export interface RotationPolicy {
  maxGraceMs(): Promise<number>;
}
