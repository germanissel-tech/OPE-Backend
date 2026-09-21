// Violation (context-map:ledger): ledger does not depend on merchant, not even at the boundary.
import { merchantAdapter } from "../merchant/index.js";
export const v = merchantAdapter;
