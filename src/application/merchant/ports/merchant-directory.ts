// Merchant directory port: what the security handlers and CORS ask about merchants (ADR-014,
// ADR-025). Credentials are looked up by their fingerprint, at the instant of the request; a
// deactivated merchant, or an expired credential, resolves to nobody. Served by the merchant
// store since feature 017 (ADR-031).
import type { Merchant } from "../../../domain/merchant/index.js";

export interface MerchantDirectory {
  /** Merchant owning a live ingest credential with this fingerprint, or `undefined` if nobody has it. */
  findByIngestKey(fingerprint: string, now: Date): Promise<Merchant | undefined>;
  /** Merchant owning a live platform credential with this fingerprint (ADR-025), or `undefined`. */
  findByPlatformKey(fingerprint: string, now: Date): Promise<Merchant | undefined>;
  /** Did any merchant that is not deactivated register this origin? The only thing the CORS preflight can ask. */
  isRegisteredOrigin(origin: string): Promise<boolean>;
}
