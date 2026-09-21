// Eval fixture: stub gateway.
export function memoryDecisionLedger(): { record(decision: unknown): void } {
  return { record: () => undefined };
}
