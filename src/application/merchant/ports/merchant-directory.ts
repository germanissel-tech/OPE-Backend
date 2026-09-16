// Port: where merchants come from. In this feature, from configuration; in 006, from the store.
import type { Merchant } from "../../../domain/merchant/index.js";

export interface MerchantDirectory {
  /** Merchant owning the credential, or `undefined` if nobody has it. */
  findByIngestKey(key: string): Merchant | undefined;
  /** Did any merchant register this origin? The only thing the CORS preflight can ask. */
  isRegisteredOrigin(origin: string): boolean;
}
