// Use case: the credential identifies the merchant and the origin, if present, must be theirs.
// Returns a result, never throws: the HTTP adapter translates each error to its Problem Details.
import {
  OriginNotAllowed,
  originAllowed,
  Unauthorized,
  type Merchant,
  type MerchantError,
} from "../../../domain/merchant/index.js";
import { fail, ok, type Result } from "../../../domain/shared-kernel/index.js";
import type { UseCase } from "../../shared-kernel/index.js";
import type { MerchantDirectory } from "../ports/merchant-directory.js";

export interface ResolveIngestKeyRequest {
  key: string | undefined;
  origin: string | undefined;
}

export type ResolveIngestKeyResponse = Result<Merchant, MerchantError>;

export interface ResolveIngestKeyDependencies {
  merchants: MerchantDirectory;
}

export class ResolveIngestKeyUseCase implements UseCase<ResolveIngestKeyRequest, ResolveIngestKeyResponse> {
  readonly #deps: ResolveIngestKeyDependencies;

  constructor(deps: ResolveIngestKeyDependencies) {
    this.#deps = deps;
  }

  execute({ key, origin }: ResolveIngestKeyRequest): Promise<ResolveIngestKeyResponse> {
    const merchant = key === undefined ? undefined : this.#deps.merchants.findByIngestKey(key);
    if (!merchant) return Promise.resolve(fail(new Unauthorized()));
    if (!originAllowed(merchant, origin)) return Promise.resolve(fail(new OriginNotAllowed()));
    return Promise.resolve(ok(merchant));
  }
}
