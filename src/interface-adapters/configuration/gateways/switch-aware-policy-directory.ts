// The policies of a merchant with its kill switch read from the merchant store (01 §14.2,
// ADR-031): what an operator switches counts on the next request. The source says what
// governs (the configuration module); the store says whether the merchant is on; a merchant
// the store does not know is off. It joins the ports of three modules (decision, configuration,
// merchant): it lives with the configuration, which is the module the context map lets see the
// three of them, and not in the composition root, where no rule of behaviour belongs (ADR-033).
import type { PolicyDirectory, PolicySource } from "../../../application/decision/index.js";
import type { MerchantStore } from "../../../application/merchant/index.js";

export function switchAwarePolicyDirectory(
  source: PolicySource,
  merchants: Pick<MerchantStore, "get">,
): PolicyDirectory {
  return {
    async policiesFor(merchantId) {
      const [policies, merchant] = await Promise.all([
        source.policySetFor(merchantId),
        merchants.get(merchantId),
      ]);
      return { ...policies, enabled: merchant?.isOn() ?? false };
    },
  };
}
