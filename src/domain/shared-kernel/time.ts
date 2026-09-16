// Named units of time (ADR-016, FR-012): every duration in the domain is written as
// `hours(24)` or `minutes(5)`, never as `24 * 60 * 60 * 1000`.
export const MS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;

/** Milliseconds in `n` seconds. */
export const seconds = (n: number): number => n * MS_PER_SECOND;
/** Milliseconds in `n` minutes. */
export const minutes = (n: number): number => seconds(n * SECONDS_PER_MINUTE);
/** Milliseconds in `n` hours. */
export const hours = (n: number): number => minutes(n * MINUTES_PER_HOUR);
