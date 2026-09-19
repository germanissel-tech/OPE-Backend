// merchant module: who the credential is and which origins are theirs. Serves no operation of
// its own; it serves the `ingestKey` and `platformKey` security schemes (ADR-014, ADR-025,
// ADR-029) and the CORS policy. Security also runs in mock: the SDK develops against the mock
// with the real key (SC-006).
import {
  DefaultIngestKeyResolver,
  DefaultPlatformKeyResolver,
  DefaultPlatformSignatureVerifier,
  type MerchantDirectory,
  type MessageAuthenticator,
} from "../../application/merchant/index.js";
import { configMerchantDirectory } from "../../interface-adapters/gateways/merchant/config-merchant-directory.js";
import { nodeMessageAuthenticator } from "../../interface-adapters/gateways/merchant/node-message-authenticator.js";
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
import type { Clock } from "../../application/shared-kernel/index.js";
import type { Merchant } from "../../domain/merchant/index.js";
import type { Bindings, Module } from "../wiring.js";

export interface MerchantPorts {
  clock: Clock;
  merchants: MerchantDirectory;
  /** The HMAC behind the platform signature (ADR-029). */
  authenticator: MessageAuthenticator;
}

/** Merchants as configuration lists them (the store arrives with persistence); the HMAC with Node's crypto. */
export const configMerchantPorts = (
  merchants: readonly Merchant[],
): Bindings<Pick<MerchantPorts, "merchants" | "authenticator">> => ({
  merchants: () => configMerchantDirectory(merchants),
  authenticator: () => nodeMessageAuthenticator,
});

export const merchantModule: Module<MerchantPorts> = ({ ports }) => {
  const resolveIngestKey = new DefaultIngestKeyResolver({ merchants: ports.merchants });
  const keys = new DefaultPlatformKeyResolver({ merchants: ports.merchants });
  const signatures = new DefaultPlatformSignatureVerifier({ authenticator: ports.authenticator });
  return {
    security: {
      [INGEST_KEY_SCHEME]: { handler: makeIngestKeySecurity(resolveIngestKey), header: INGEST_KEY_HEADER },
      [PLATFORM_KEY_SCHEME]: {
        handler: makePlatformKeySecurity({ keys, signatures, clock: ports.clock }),
        header: PLATFORM_KEY_HEADER,
      },
    },
    cors: ports.merchants,
  };
};
