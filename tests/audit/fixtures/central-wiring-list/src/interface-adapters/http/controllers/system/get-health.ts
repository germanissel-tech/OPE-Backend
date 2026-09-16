// Eval fixture: stub controller.
import type { GetServiceHealth } from "../../../../application/system/index.js";
export function makeGetHealth(getServiceHealth: GetServiceHealth): () => Promise<unknown> {
  return () => Promise.resolve(getServiceHealth());
}
