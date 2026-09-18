// Application service: the platform credential identifies the merchant (ADR-025). Server to
// server: no origin to check, no browser. Authentication is not a use case (ADR-023): the
// `platformKey` security handler consults this service before any use case runs.
import { Unauthorized, type Merchant } from "../../../domain/merchant/index.js";
import { fail, ok, type Result } from "../../../domain/shared-kernel/index.js";
import type { MerchantDirectory } from "../ports/merchant-directory.js";

export type PlatformKeyResolution = Result<Merchant, Unauthorized>;

export interface PlatformKeyResolver {
  resolve(key: string | undefined): Promise<PlatformKeyResolution>;
}

export interface PlatformKeyResolverDependencies {
  merchants: MerchantDirectory;
}

export class DefaultPlatformKeyResolver implements PlatformKeyResolver {
  readonly #deps: PlatformKeyResolverDependencies;

  constructor(deps: PlatformKeyResolverDependencies) {
    this.#deps = deps;
  }

  async resolve(key: string | undefined): Promise<PlatformKeyResolution> {
    const merchant = key === undefined ? undefined : await this.#deps.merchants.findByPlatformKey(key);
    return merchant ? ok(merchant) : fail(new Unauthorized());
  }
}
