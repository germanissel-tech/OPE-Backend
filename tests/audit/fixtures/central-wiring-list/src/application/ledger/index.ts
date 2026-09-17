// Eval fixture: stub of the ledger module's public API.
export type ConfirmExposure = () => Promise<{ ok: boolean }>;
export function makeConfirmExposure(deps: { clock: { now(): Date } }): ConfirmExposure {
  return () => Promise.resolve({ ok: deps.clock.now().getTime() > 0 });
}
