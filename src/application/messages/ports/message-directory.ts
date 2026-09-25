// Message directory port (feature 027, constitution X): what a merchant declared about the texts
// it is served — which voice, which languages, and which of its own attribute labels correspond to
// OPE's vocabulary. The configuration module resolves it value by value over the treatment
// defaults and the composition binds it, the same way it does with the policy directory.
import type { MerchantId, Voice } from "../../../domain/shared-kernel/index.js";

export interface MessageSettings {
  voice: Voice;
  /** The language to fall back to when the page's has no text; one and optional (01 §14.2, DECIDIDO). */
  fallback?: string;
}

export interface MessageDirectory {
  settingsFor(merchantId: MerchantId): Promise<MessageSettings>;
}
