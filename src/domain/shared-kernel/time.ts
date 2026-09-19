// Named units of time (ADR-016, FR-012): every duration in the domain is written as
// `hours(24)` or `minutes(5)`, never as `24 * 60 * 60 * 1000`.
export const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

/** Milliseconds in `n` seconds. */
export const seconds = (n: number): number => n * MS_PER_SECOND;
/** Milliseconds in `n` minutes. */
export const minutes = (n: number): number => seconds(n * SECONDS_PER_MINUTE);
/** Milliseconds in `n` hours. */
export const hours = (n: number): number => minutes(n * MINUTES_PER_HOUR);

const CLOCK_SKEW_TOLERANCE_MINUTES = 5;
/**
 * How far ahead of OPE's clock a client's clock may be before an instant it declares is a
 * clock error: events, catalogue captures, order confirmations and platform signatures share
 * it (contract `x-invariants`, ADR-025, ADR-028, ADR-029).
 */
export const CLOCK_SKEW_TOLERANCE_MS = minutes(CLOCK_SKEW_TOLERANCE_MINUTES);
