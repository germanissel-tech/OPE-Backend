// The security handler of the platform asks who presented the platform key (ADR-025). Looked
// up by fingerprint at the instant of the request; expired or deactivated resolves to nobody.
import { Unauthorized, type Merchant } from "../../../domain/merchant/index.js";
import { fail, ok, type Result } from "../../../domain/shared-kernel/index.js";
import type { Clock } from "../../shared-kernel/index.js";
import type { CredentialMinter } from "../ports/credential-minter.js";
import type { MerchantDirectory } from "../ports/merchant-directory.js";

export type PlatformKeyResolution = Result<Merchant, Unauthorized>;

export interface PlatformKeyResolver {
  resolve(key: string | undefined): Promise<PlatformKeyResolution>;
}

export interface PlatformKeyResolverDependencies {
  merchants: MerchantDirectory;
  minter: CredentialMinter;
  clock: Clock;
}

export class DefaultPlatformKeyResolver implements PlatformKeyResolver {
  readonly #deps: PlatformKeyResolverDependencies;

  constructor(deps: PlatformKeyResolverDependencies) {
    this.#deps = deps;
  }

  async resolve(key: string | undefined): Promise<PlatformKeyResolution> {
    const { merchants, minter, clock } = this.#deps;
    if (key === undefined || key === "") return fail(new Unauthorized());
    const merchant = await merchants.findByPlatformKey(await minter.fingerprintOf(key), clock.now());
    return merchant ? ok(merchant) : fail(new Unauthorized());
  }
}
