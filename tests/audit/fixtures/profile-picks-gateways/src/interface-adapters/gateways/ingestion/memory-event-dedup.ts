// Eval fixture: stub gateway.
export function memoryEventDedup(clock: { now(): Date }): { claim(ids: string[]): Set<string>; at: Date } {
  return { claim: (ids) => new Set(ids), at: clock.now() };
}
