// In-memory exposure ledger. Composite key merchant + decision.
import { ok, type DecisionId, type MerchantId } from "../../../domain/shared-kernel/index.js";
import type { ExposureLedger } from "../../../application/ledger/index.js";
import type { Exposure } from "../../../domain/ledger/index.js";

export function memoryExposureLedger(): ExposureLedger {
  const exposures = new Map<string, Exposure>();
  const key = (merchantId: MerchantId, decisionId: DecisionId): string => `${merchantId}/${decisionId}`;
  return {
    record(exposure) {
      const k = key(exposure.merchantId, exposure.decisionId);
      if (exposures.has(k)) return ok("already-recorded");
      exposures.set(k, exposure);
      return ok("recorded");
    },
    find(merchantId, decisionId) {
      return exposures.get(key(merchantId, decisionId));
    },
  };
}
