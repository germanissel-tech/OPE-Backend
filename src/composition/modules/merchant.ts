// merchant module: who the credential is and which origins are theirs. Serves no operation of
// its own; it serves the `ingestKey` security scheme (ADR-014) and the CORS policy. Security
// also runs in mock: the SDK develops against the mock with the real key (SC-006).
import { makeResolveIngestKey, type MerchantDirectory } from "../../application/merchant/index.js";
import {
  INGEST_KEY_SCHEME,
  makeIngestKeySecurity,
} from "../../interface-adapters/http/security/ingest-key.js";
import type { Module } from "../wiring.js";

export interface MerchantPorts {
  merchants: MerchantDirectory;
}

export const merchantModule: Module<MerchantPorts> = ({ ports }) => {
  const resolveIngestKey = makeResolveIngestKey(ports.merchants);
  return {
    security: { [INGEST_KEY_SCHEME]: makeIngestKeySecurity(resolveIngestKey) },
    cors: ports.merchants,
  };
};
