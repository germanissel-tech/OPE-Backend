// Application service: the credential identifies the merchant and the origin, if present, must
// be theirs. Authentication is not a use case (ADR-023): it is a policy the security adapter
// consults before validation and before any use case runs, so it lives here as a service the
// `ingestKey` security handler depends on by interface. Returns a result, never throws.
import { OriginNotAllowed, Unauthorized, type Merchant } from "../../../domain/merchant/index.js";
import { fail, ok, type Result } from "../../../domain/shared-kernel/index.js";
import type { MerchantDirectory } from "../ports/merchant-directory.js";

export type IngestKeyResolution = Result<Merchant, Unauthorized | OriginNotAllowed>;

export interface IngestKeyResolver {
  resolve(key: string | undefined, origin: string | undefined): Promise<IngestKeyResolution>;
}

export interface IngestKeyResolverDependencies {
  merchants: MerchantDirectory;
}

export class DefaultIngestKeyResolver implements IngestKeyResolver {
  readonly #deps: IngestKeyResolverDependencies;

  constructor(deps: IngestKeyResolverDependencies) {
    this.#deps = deps;
  }

  async resolve(key: string | undefined, origin: string | undefined): Promise<IngestKeyResolution> {
    const merchant = key === undefined ? undefined : await this.#deps.merchants.findByIngestKey(key);
    if (!merchant) return fail(new Unauthorized());
    if (!merchant.allowsOrigin(origin)) return fail(new OriginNotAllowed());
    return ok(merchant);
  }
}
