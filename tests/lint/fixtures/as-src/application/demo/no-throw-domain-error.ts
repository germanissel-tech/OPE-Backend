// Lint fixture (as if under src/application/): violates only ope/no-throw-domain-error.
// A business error is thrown instead of returned with fail().
import { LedgerUnavailable } from "../../../../../../src/domain/ledger/index.js";

export function record(down: boolean): void {
  if (down) throw new LedgerUnavailable();
}
