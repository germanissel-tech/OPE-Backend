// Merchant directory loaded from configuration (local profile).
import { findByIngestKey, normalizeOrigin, type Merchant } from "../../../domain/merchant/index.js";
import { asMerchantId } from "../../../domain/shared-kernel/index.js";
import type { MerchantDirectory } from "../../../application/merchant/index.js";

export interface MerchantRecord {
  merchantId: string;
  ingestKeys: readonly string[];
  origins: readonly string[];
}

export function configMerchantDirectory(records: readonly MerchantRecord[]): MerchantDirectory {
  const merchants: Merchant[] = records.map((r) => ({
    merchantId: asMerchantId(r.merchantId),
    ingestKeys: [...r.ingestKeys],
    origins: [...r.origins],
  }));
  const origins = new Set(
    merchants.flatMap((m) => m.origins.map(normalizeOrigin)).filter((o) => o !== undefined),
  );
  return {
    findByIngestKey: (key) => Promise.resolve(findByIngestKey(merchants, key)),
    isRegisteredOrigin: (origin) => {
      const wanted = normalizeOrigin(origin);
      return Promise.resolve(wanted !== undefined && origins.has(wanted));
    },
  };
}
