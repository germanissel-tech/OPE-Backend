// Fixture de tests/architecture: violación deliberada o módulo auxiliar.
import type { Decision } from "../ledger/index.js";
import type { Merchant } from "../merchant/index.js";
export interface Event {
  merchant: Merchant;
  decision: Decision;
}
