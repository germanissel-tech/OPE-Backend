// Unit of work port (feature 034, D-28): several writes that are applied together or not at all.
//
// It lives in the kernel for the same reason the audit trail does: **any module may have to promise that
// two things happened together**, and none of them should have to depend on the module that stores either
// of the two. Today there is one user — the audit decorator, which needs the action and its entry to be
// one fact (ADR-034) — and the port is what keeps that from being a favour the administration does the
// rest of the system.
//
// **What it is not**: a transaction of the store. A transaction is how the durable deployment keeps this
// promise; the deployment that keeps nothing in common has nothing to compose and says so by answering
// `ok` (research R-05 of this feature). A use case never sees either.
import type { Result, StoreUnavailable } from "../../../domain/shared-kernel/index.js";

export interface UnitOfWork {
  /**
   * Runs `work` as one unit: what it wrote is kept when the work resolves, and **reverted when the work
   * calls `abort`**.
   *
   * **`work` receives `abort` instead of throwing**, and that is the whole shape of this port. Reverting
   * by throwing would need a `catch` where the unit is opened — forbidden in this ring (ADR-023), and it
   * would turn a failure the contract declares as `503` into a `500`. So the failure travels as a value,
   * the caller returns it as the response of its operation, and the throw that actually reverts stays in
   * the adapter.
   *
   * **A failed `Result` from the work is not a reason to revert**: a business rejection is something an
   * operator did and its audit entry has to stay. Only `abort` reverts, and only the caller knows when.
   */
  scope<T>(work: (abort: () => void) => Promise<T>): Promise<Result<T, StoreUnavailable>>;
}
