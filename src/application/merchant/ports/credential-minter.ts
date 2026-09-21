// Credential minter port (ADR-031): random credentials and their fingerprints, and merchant
// identifiers. Randomness and digests live behind a port: the application imports nothing from Node.
import type { CredentialKind } from "../../../domain/merchant/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export interface MintedCredential {
  /** The value, shown once to whoever asked for it. */
  value: string;
  /** SHA-256 hex of the value: what the platform keeps. */
  fingerprint: string;
}

export interface CredentialMinter {
  mint(kind: CredentialKind): Promise<MintedCredential>;
  fingerprintOf(value: string): Promise<string>;
  mintMerchantId(): Promise<MerchantId>;
}
