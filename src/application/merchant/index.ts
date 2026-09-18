// Public API of the merchant module (application).
export type { MerchantDirectory } from "./ports/merchant-directory.js";
export { DefaultIngestKeyResolver } from "./services/ingest-key.service.js";
export type {
  IngestKeyResolution,
  IngestKeyResolver,
  IngestKeyResolverDependencies,
} from "./services/ingest-key.service.js";
