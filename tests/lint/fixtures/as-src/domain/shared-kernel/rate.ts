// Lint fixture (as if it were src/domain/shared-kernel/rate.ts): a shared-kernel primitive may be
// a loose function; the rule's allowlist names the file.
export const isRate = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1;
