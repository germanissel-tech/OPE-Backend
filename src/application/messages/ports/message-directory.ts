// Message directory port (feature 027, constitution X): what a merchant declared about the texts
// it is served — which languages, and which of its own attribute labels correspond to OPE's
// vocabulary. The configuration module resolves it value by value over the treatment defaults and
// the composition binds it, the same way it does with the policy directory.
//
// The voice left in feature 038: with a layer of texts per merchant, a merchant's preference is its own
// layer and not a style it picks, so there was nothing left for a voice to name.
import type { AttributeLabels } from "../../../domain/messages/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export interface MessageSettings {
  /** What the merchant's own attribute labels correspond to in OPE's vocabulary. */
  labels: AttributeLabels;
  /** The language to fall back to when the page's has no text; one and optional (01 §14.2, DECIDIDO). */
  fallback?: string;
}

export interface MessageDirectory {
  settingsFor(merchantId: MerchantId): Promise<MessageSettings>;
}
