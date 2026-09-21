// Eval fixture: stub gateway.
export function memoryExposureLedger(): { record(exposure: unknown): void } {
  return { record: () => undefined };
}
