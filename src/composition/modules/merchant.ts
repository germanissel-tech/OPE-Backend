// merchant module: who the credential is and which origins are theirs. Serves no operation of
// its own; it serves the `ingestKey` security scheme (ADR-014) and the CORS policy. Security
// also runs in mock: the SDK develops against the mock with the real key (SC-006).
import {
  DefaultIngestKeyResolver,
  DefaultPlatformKeyResolver,
  type MerchantDirectory,
} from "../../application/merchant/index.js";
import { configMerchantDirectory } from "../../interface-adapters/gateways/merchant/config-merchant-directory.js";
import {
  INGEST_KEY_HEADER,
  INGEST_KEY_SCHEME,
  makeIngestKeySecurity,
} from "../../interface-adapters/http/security/ingest-key.js";
import {
  makePlatformKeySecurity,
  PLATFORM_KEY_HEADER,
  PLATFORM_KEY_SCHEME,
} from "../../interface-adapters/http/security/platform-key.js";
import type { Merchant } from "../../domain/merchant/index.js";
import type { Bindings, Module } from "../wiring.js";

export interface MerchantPorts {
  merchants: MerchantDirectory;
}

/** Merchants as configuration lists them (the store arrives with persistence). */
export const configMerchantPorts = (merchants: readonly Merchant[]): Bindings<MerchantPorts> => ({
  merchants: () => configMerchantDirectory(merchants),
});

export const merchantModule: Module<MerchantPorts> = ({ ports }) => {
  const resolveIngestKey = new DefaultIngestKeyResolver({ merchants: ports.merchants });
  const resolvePlatformKey = new DefaultPlatformKeyResolver({ merchants: ports.merchants });
  return {
    security: {
      [INGEST_KEY_SCHEME]: { handler: makeIngestKeySecurity(resolveIngestKey), header: INGEST_KEY_HEADER },
      [PLATFORM_KEY_SCHEME]: {
        handler: makePlatformKeySecurity(resolvePlatformKey),
        header: PLATFORM_KEY_HEADER,
      },
    },
    cors: ports.merchants,
  };
};
