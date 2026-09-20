// Predicates over the numbers the domain reasons with (CLAUDE.md § Convenciones): inside the
// domain a share is a rate 0..1 and a count is a non-negative number. Written once so every
// module that judges a threshold, a weight or a split names the same rule.

/** A finite number in 0..1 inclusive: a share, a weight, a threshold. */
export const isRate = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1;

/** A finite number of at least zero: an occurrence count, a duration, a minimum. */
export const isCount = (value: number): boolean => Number.isFinite(value) && value >= 0;
