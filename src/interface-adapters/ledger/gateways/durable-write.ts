// How a refused write of the **ledger** becomes a value: `LedgerUnavailable`, which is what makes the
// decision plane fail closed (ADR-021) instead of intervening without having recorded.
//
// **The shared half moved to the kernel of this ring** (`shared-kernel/durable-store.ts`) when feature
// 033 made the merchant store durable: `merchant` may not depend on `ledger`, and rightly so. What stays
// here is the one thing that is the ledger's — the name of its failure — and the reason it has its own
// name is that an operator reading a log needs to tell a degraded decision from a refused administration
// action.
import { LedgerUnavailable } from "../../../domain/ledger/index.js";
import { tried, type DurableGatewayDeps } from "../../shared-kernel/index.js";
import type { Result } from "../../../domain/shared-kernel/index.js";

export type { DurableGatewayDeps };

export function attempted<T>(
  deps: DurableGatewayDeps,
  what: string,
  work: () => T,
): Promise<Result<T, LedgerUnavailable>> {
  return tried(deps, what, work, () => new LedgerUnavailable());
}
