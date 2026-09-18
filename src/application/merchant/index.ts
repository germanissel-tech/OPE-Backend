// Public API of the merchant module (application).
export type { MerchantDirectory } from "./ports/merchant-directory.js";
export { ResolveIngestKeyUseCase } from "./use-cases/resolve-ingest-key.use-case.js";
export type {
  ResolveIngestKeyDependencies,
  ResolveIngestKeyRequest,
  ResolveIngestKeyResponse,
} from "./use-cases/resolve-ingest-key.use-case.js";
