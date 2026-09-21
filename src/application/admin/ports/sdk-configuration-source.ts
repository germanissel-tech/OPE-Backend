// SDK configuration port (01 §3.1.1; constitution XI): what of the effective configuration of a
// merchant the SDK may see — versions, surfaces, languages and the anchor map; never a policy.
// The configuration module serves it; the composition binds it.
import type { AnchorMapRecord, Locales, Surface } from "../../../domain/configuration/index.js";
import type { ConfigurationVersions, MerchantId } from "../../../domain/shared-kernel/index.js";

export interface SdkConfigurationView {
  versions: ConfigurationVersions;
  surfaces: readonly Surface[];
  locales: Locales;
  /** Absent when the merchant declared no anchor map: the SDK resolves by its own chain. */
  anchors?: AnchorMapRecord | undefined;
}

export interface SdkConfigurationSource {
  sdkConfigurationFor(merchantId: MerchantId): Promise<SdkConfigurationView>;
}
