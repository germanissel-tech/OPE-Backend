// getMerchantTextVersion (feature 038, US5): one version of a merchant's key, by its number, as it was
// published, within the operator's scope over the merchant. A number nobody published never existed, and
// a key outside the vocabulary has no versions at all: both are a `404`.
import {
  TextKey,
  TextVersionNotFound,
  type TextKeyInput,
  type TextVersion,
} from "../../../domain/messages/index.js";
import { fail, ok, type MerchantId, type Result } from "../../../domain/shared-kernel/index.js";
import type { MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { ScopedMerchantService } from "../../merchant/index.js";
import type { UseCase } from "../../shared-kernel/index.js";
import type { TextStore } from "../ports/text-store.js";

export interface GetMerchantTextVersionRequest {
  actor: Operator;
  merchantId: MerchantId;
  key: TextKeyInput;
  version: number;
}

export type GetMerchantTextVersionResponse = Result<
  TextVersion,
  MerchantOutOfScope | MerchantNotFound | TextVersionNotFound
>;

export interface GetMerchantTextVersionDependencies {
  scoped: ScopedMerchantService;
  texts: TextStore;
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
    return version === undefined ? fail(TextVersionNotFound.numbered(request.version)) : ok(version);
  }
}
