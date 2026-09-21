// In-memory configuration store (ADR-031): the versions of every merchant, numbered as they are
// published — the number is the size of the list plus one, assigned and written without an
// await in between (01 §6). Nothing crosses merchants; nothing is overwritten.
import { MerchantConfigurationVersion } from "../../../domain/configuration/index.js";
import { ok, type MerchantId } from "../../../domain/shared-kernel/index.js";
import { pageOf } from "../../shared-kernel/paging.js";
import type { ConfigurationStore } from "../../../application/configuration/index.js";

export function memoryConfigurationStore(): ConfigurationStore {
  const byMerchant = new Map<MerchantId, MerchantConfigurationVersion[]>();
  const versionsOf = (merchantId: MerchantId): MerchantConfigurationVersion[] =>
    byMerchant.get(merchantId) ?? [];
  return {
    publish(draft) {
      const versions = versionsOf(draft.merchantId);
      const numbered = MerchantConfigurationVersion.numbered(draft, versions.length + 1);
      byMerchant.set(draft.merchantId, [...versions, numbered]);
      return Promise.resolve(ok(numbered));
    },
    latestOf(merchantId) {
      return Promise.resolve(versionsOf(merchantId).at(-1));
    },
    versionsOf(merchantId, query) {
      return Promise.resolve(pageOf([...versionsOf(merchantId)].reverse(), query));
    },
  };
}
