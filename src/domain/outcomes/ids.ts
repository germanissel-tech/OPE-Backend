// The identity of an order: the platform issues it, unique per merchant (01 §6); owned by the
// outcomes module, referenced by orders, returns and corroborations.
import type { Branded } from "../shared-kernel/index.js";

export type OrderId = Branded<string, "OrderId">;

/** The contract already validated the pattern; here only the brand is applied. */
export const asOrderId = (value: string): OrderId => value as OrderId;
