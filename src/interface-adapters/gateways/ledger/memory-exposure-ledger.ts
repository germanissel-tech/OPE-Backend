// In-memory exposure ledger. Composite key merchant + decision.
import type { ExposureLedger } from "../../../application/ledger/index.js";
import type { Exposure } from "../../../domain/ledger/index.js";
import type { DecisionId, MerchantId } from "../../../domain/shared-kernel/index.js";

export function memoryExposureLedger(): ExposureLedger {
  const exposures = new Map<string, Exposure>();
  const key = (merchantId: MerchantId, decisionId: DecisionId): string => `${merchantId}/${decisionId}`;
  return {
    record(exposure) {
      const k = key(exposure.merchantId, exposure.decisionId);
      if (exposures.has(k)) return "already-recorded";
      exposures.set(k, exposure);
      return "recorded";
    },
    find(merchantId, decisionId) {
      return exposures.get(key(merchantId, decisionId));
    },
  };
}
