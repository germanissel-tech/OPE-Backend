// Fixture de tests/architecture: violación deliberada o módulo auxiliar.
import type { Merchant } from "../../../domain/merchant/index.js";
export interface Directory {
  find(): Merchant | undefined;
}
