// Merchant directory port: who owns a credential and which origins are registered.
import type { Merchant } from "../../../domain/merchant/index.js";

export interface MerchantDirectory {
  /** Merchant owning the credential, or `undefined` if nobody has it. */
  findByIngestKey(key: string): Promise<Merchant | undefined>;
  /** Did any merchant register this origin? The only thing the CORS preflight can ask. */
  isRegisteredOrigin(origin: string): Promise<boolean>;
}
