// The security handler of the notices asks who presented the notice key (feature 044, research R-06). Looked
// up by fingerprint at the instant of the notice; expired or deactivated resolves to nobody. A key of another
// kind is nobody too: the notice key grants only `notices:write`, and nothing else grants that.
import { Unauthorized, type Merchant } from "../../../domain/merchant/index.js";
import { fail, ok, type Result } from "../../../domain/shared-kernel/index.js";
import { type CredentialMinter, type MerchantDirectory } from "../../merchant/index.js";
import type { Clock } from "../../shared-kernel/index.js";

export interface NoticeKeyResolver {
  resolve(key: string | undefined): Promise<Result<Merchant, Unauthorized>>;
}

export interface NoticeKeyResolverDependencies {
  merchants: MerchantDirectory;
  minter: CredentialMinter;
  clock: Clock;
}

export class DefaultNoticeKeyResolver implements NoticeKeyResolver {
  readonly #deps: NoticeKeyResolverDependencies;

  constructor(deps: NoticeKeyResolverDependencies) {
    this.#deps = deps;
  }

  async resolve(key: string | undefined): Promise<Result<Merchant, Unauthorized>> {
    if (key === undefined || key === "") return fail(new Unauthorized());
    const fingerprint = await this.#deps.minter.fingerprintOf(key);
    const merchant = await this.#deps.merchants.findByNoticeKey(fingerprint, this.#deps.clock.now());
    return merchant === undefined ? fail(new Unauthorized()) : ok(merchant);
  }
}
