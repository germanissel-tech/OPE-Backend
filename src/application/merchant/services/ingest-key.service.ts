// The security handler of the SDK asks who presented the ingest key and whether the Origin may
// speak for it (ADR-014, ADR-023). The key is looked up by fingerprint at the instant of the
// request: a rotated key that ran out of grace, or a deactivated merchant, is unauthorized.
import { OriginNotAllowed, Unauthorized, type Merchant } from "../../../domain/merchant/index.js";
import { fail, ok, type Result } from "../../../domain/shared-kernel/index.js";
import type { Clock } from "../../shared-kernel/index.js";
import type { CredentialMinter } from "../ports/credential-minter.js";
import type { MerchantDirectory } from "../ports/merchant-directory.js";

export type IngestKeyResolution = Result<Merchant, Unauthorized | OriginNotAllowed>;

export interface IngestKeyResolver {
  resolve(key: string | undefined, origin: string | undefined): Promise<IngestKeyResolution>;
}

export interface IngestKeyResolverDependencies {
  merchants: MerchantDirectory;
  minter: CredentialMinter;
  clock: Clock;
}

export class DefaultIngestKeyResolver implements IngestKeyResolver {
  readonly #deps: IngestKeyResolverDependencies;

  constructor(deps: IngestKeyResolverDependencies) {
    this.#deps = deps;
  }

  async resolve(key: string | undefined, origin: string | undefined): Promise<IngestKeyResolution> {
    const { merchants, minter, clock } = this.#deps;
    if (key === undefined || key === "") return fail(new Unauthorized());
    const merchant = await merchants.findByIngestKey(await minter.fingerprintOf(key), clock.now());
    if (!merchant) return fail(new Unauthorized());
    if (!merchant.allowsOrigin(origin)) return fail(new OriginNotAllowed());
    return ok(merchant);
  }
}
