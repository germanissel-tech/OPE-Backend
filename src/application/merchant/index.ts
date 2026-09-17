// Public API of the merchant module (application).
export { makeResolveIngestKey } from "./resolve-ingest-key.js";
export type {
  ResolveIngestKey,
  ResolveIngestKeyInput,
  ResolveIngestKeyResult,
} from "./resolve-ingest-key.js";
export type { MerchantDirectory } from "./ports/merchant-directory.js";
