// A rule, not a policy: fine.
export const isRate = (value: number): boolean => value >= 0 && value <= 1;
