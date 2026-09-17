// Eval fixture: stub of the system module's public API.
export type GetServiceHealth = () => { status: "ok"; at: Date };
export function makeGetServiceHealth(deps: { clock: { now(): Date } }): GetServiceHealth {
  return () => ({ status: "ok", at: deps.clock.now() });
}
