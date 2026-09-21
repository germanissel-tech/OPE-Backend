// In-memory merchant store (ADR-031): the single source of truth of the merchants, serving both
// the store (writes by intention) and the directory the security handlers read. One instance
// behind both ports is what makes an administration change count on the next request.
import { ok, type MerchantId } from "../../../domain/shared-kernel/index.js";
import { pageOf } from "../../shared-kernel/index.js";
import type { MerchantDirectory, MerchantStore } from "../../../application/merchant/index.js";
import type { Merchant } from "../../../domain/merchant/index.js";

export function memoryMerchantStore(): MerchantStore & MerchantDirectory {
  const merchants = new Map<MerchantId, Merchant>();
  const all = (): Merchant[] => [...merchants.values()];
  return {
    create(merchant) {
      merchants.set(merchant.merchantId, merchant);
      return Promise.resolve(ok(undefined));
    },
    update(merchant) {
      merchants.set(merchant.merchantId, merchant);
      return Promise.resolve(ok(undefined));
    },
    get(merchantId) {
      return Promise.resolve(merchants.get(merchantId));
    },
    list(query) {
      return Promise.resolve(pageOf(all(), query));
    },
    ownerOfOrigin(origin) {
      return Promise.resolve(all().find((m) => m.allowsOrigin(origin))?.merchantId);
    },
    isEmpty() {
      return Promise.resolve(merchants.size === 0);
    },
    findByIngestKey(fingerprint, now) {
      return Promise.resolve(all().find((m) => m.owns(fingerprint, now)));
    },
    findByPlatformKey(fingerprint, now) {
      return Promise.resolve(all().find((m) => m.ownsPlatformKey(fingerprint, now)));
    },
    isRegisteredOrigin(origin) {
      return Promise.resolve(all().some((m) => !m.isDeactivated() && m.allowsOrigin(origin)));
    },
  };
}
