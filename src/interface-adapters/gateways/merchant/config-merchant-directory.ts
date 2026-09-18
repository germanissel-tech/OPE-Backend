// Merchant directory over the configured merchants (local profile). Only a lookup: the rules
// (who owns a key, what an origin is) belong to the Merchant and the Origin.
import { Origin, type Merchant } from "../../../domain/merchant/index.js";
import type { MerchantDirectory } from "../../../application/merchant/index.js";

export function configMerchantDirectory(merchants: readonly Merchant[]): MerchantDirectory {
  const registered = merchants.flatMap((m) => m.origins);
  return {
    findByIngestKey: (key) => Promise.resolve(merchants.find((m) => m.owns(key))),
    isRegisteredOrigin: (text) => {
      const wanted = Origin.parse(text);
      return Promise.resolve(wanted !== undefined && registered.some((o) => o.equals(wanted)));
    },
  };
}
