// Merchants for unit tests (feature 017): built the way the store keeps them — credentials by
// fingerprint — with a fake minter whose fingerprint is `fp:<value>`, so a test can read it.
import { Merchant, type Credential } from "../../src/domain/merchant/index.js";
import { asMerchantId } from "../../src/domain/shared-kernel/index.js";
import type { CredentialMinter } from "../../src/application/merchant/index.js";

export const TEST_NOW = new Date("2026-09-19T12:00:00.000Z");

/** The fingerprint the fake minter gives a value. */
export const fingerprintOf = (value: string): string => `fp:${value}`;

let minted = 0;

/** A minter whose values are predictable and whose fingerprints are readable. */
export const fakeMinter: CredentialMinter = {
  mint: (kind) => {
    minted += 1;
    const value = `${kind}-value-${minted}`;
    return Promise.resolve({ value, fingerprint: fingerprintOf(value) });
  },
  fingerprintOf: (value) => Promise.resolve(fingerprintOf(value)),
  mintMerchantId: () => {
    minted += 1;
    return Promise.resolve(asMerchantId(`mrc_minted${String(minted).padStart(6, "0")}`));
  },
};

export interface TestMerchantSpec {
  merchantId?: string;
  ingestKeys?: string[];
  origins?: string[];
  platformKeys?: string[];
  platformSecrets?: string[];
  createdAt?: Date;
}

/** A merchant whose keys `ingestKeys`... resolve by `fingerprintOf(key)`. */
export function testMerchant(spec: TestMerchantSpec = {}): Merchant {
  const at = spec.createdAt ?? TEST_NOW;
  const credentials: Credential[] = [
    ...(spec.ingestKeys ?? ["key-a-1"]).map((k) => Merchant.credential("ingest", fingerprintOf(k), at)),
    ...(spec.platformKeys ?? []).map((k) => Merchant.credential("platform", fingerprintOf(k), at)),
    ...(spec.platformSecrets ?? []).map((s) => Merchant.credential("signing", fingerprintOf(s), at, s)),
  ];
  const built = Merchant.of({
    merchantId: asMerchantId(spec.merchantId ?? "m_a"),
    origins: spec.origins ?? ["https://a.example"],
    credentials,
    createdAt: at,
  });
  if (!built.ok) throw new Error(`test merchant: ${built.error.message}`);
  return built.value;
}
