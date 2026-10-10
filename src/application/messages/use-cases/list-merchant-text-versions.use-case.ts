// listMerchantTextVersions (feature 038, US5): the history of a merchant's key, newest first and paginated,
// within the operator's scope over the merchant. A version without a text is the one that removed the
// merchant's text, and it stays in the history like any other. A key outside the vocabulary has no
// history: the page is empty, not a refusal.
import { TextKey, type TextKeyInput } from "../../../domain/messages/index.js";
import { ok, type MerchantId, type Result } from "../../../domain/shared-kernel/index.js";
import { readEach, type Page, type PageQuery, type UseCase } from "../../shared-kernel/index.js";
import type { MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { ScopedMerchantService } from "../../merchant/index.js";
import type { TextStore } from "../ports/text-store.js";
import type { TextVersionRead } from "../published-text.js";
import type { ReachedByTextService } from "../services/reached-by-text.service.js";

export interface ListMerchantTextVersionsRequest {
  actor: Operator;
  merchantId: MerchantId;
  key: TextKeyInput;
  page: PageQuery;
}

export type ListMerchantTextVersionsResponse = Result<
  Page<TextVersionRead>,
  MerchantOutOfScope | MerchantNotFound
>;

export interface ListMerchantTextVersionsDependencies {
  scoped: ScopedMerchantService;
  texts: TextStore;
  /** What each version restarted, asked of the experiments (feature 042). */
  reached: ReachedByTextService;
}

export class ListMerchantTextVersionsUseCase implements UseCase<
  ListMerchantTextVersionsRequest,
  ListMerchantTextVersionsResponse
> {
  readonly #deps: ListMerchantTextVersionsDependencies;

  constructor(deps: ListMerchantTextVersionsDependencies) {
    this.#deps = deps;
  }

  async execute(request: ListMerchantTextVersionsRequest): Promise<ListMerchantTextVersionsResponse> {
    const found = await this.#deps.scoped.find(request.actor, request.merchantId);
    if (!found.ok) return found;
    const key = TextKey.of(request.key);
    if (!key.ok) return ok({ items: [] });
    const { texts, reached } = this.#deps;
    const page = await texts.versionsOf(request.merchantId, key.value.record(), request.page);
    return ok(await readEach(page, (version) => reached.restartedBy(version)));
  }
}
