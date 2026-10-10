// getMerchantTextVersion (feature 038, US5): one version of a merchant's key, by its number, as it was
// published, within the operator's scope over the merchant. A number nobody published never existed, and
// a key outside the vocabulary has no versions at all: both are a `404`.
import { TextKey, TextVersionNotFound, type TextKeyInput } from "../../../domain/messages/index.js";
import { fail, ok, type MerchantId, type Result } from "../../../domain/shared-kernel/index.js";
import type { MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { ScopedMerchantService } from "../../merchant/index.js";
import type { UseCase } from "../../shared-kernel/index.js";
import type { TextStore } from "../ports/text-store.js";
import type { TextVersionRead } from "../published-text.js";
import type { ReachedByTextService } from "../services/reached-by-text.service.js";

export interface GetMerchantTextVersionRequest {
  actor: Operator;
  merchantId: MerchantId;
  key: TextKeyInput;
  version: number;
}

export type GetMerchantTextVersionResponse = Result<
  TextVersionRead,
  MerchantOutOfScope | MerchantNotFound | TextVersionNotFound
>;

export interface GetMerchantTextVersionDependencies {
  scoped: ScopedMerchantService;
  texts: TextStore;
  /** What each version restarted, asked of the experiments (feature 042). */
  reached: ReachedByTextService;
}

export class GetMerchantTextVersionUseCase implements UseCase<
  GetMerchantTextVersionRequest,
  GetMerchantTextVersionResponse
> {
  readonly #deps: GetMerchantTextVersionDependencies;

  constructor(deps: GetMerchantTextVersionDependencies) {
    this.#deps = deps;
  }

  async execute(request: GetMerchantTextVersionRequest): Promise<GetMerchantTextVersionResponse> {
    const found = await this.#deps.scoped.find(request.actor, request.merchantId);
    if (!found.ok) return found;
    const key = TextKey.of(request.key);
    const version = key.ok
      ? await this.#deps.texts.versionOf(request.merchantId, key.value.record(), request.version)
      : undefined;
    if (version === undefined) return fail(TextVersionNotFound.numbered(request.version));
    return ok(await this.#deps.reached.restartedBy(version));
  }
}
