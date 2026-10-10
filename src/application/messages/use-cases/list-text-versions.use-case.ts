// listTextVersions (feature 038, US5): the history of a base key, newest first and paginated — what makes
// the text an intervention stamped **explainable** after it was corrected. Nothing is ever deleted from a
// history, so the first version is the seed's and the rest an operator's.
//
// **It does not take an operator's scope**: the base is served to every merchant, so there is no merchant
// to check against; the capability `texts:read` of the admin consumer is compared at the edge (ADR-020).
// A key outside the vocabulary has no history: the page is empty, not a refusal.
import { TextKey, type TextKeyInput } from "../../../domain/messages/index.js";
import { readEach, type Page, type PageQuery, type UseCase } from "../../shared-kernel/index.js";
import type { TextStore } from "../ports/text-store.js";
import type { TextVersionRead } from "../published-text.js";
import type { ReachedByTextService } from "../services/reached-by-text.service.js";

export interface ListTextVersionsRequest {
  key: TextKeyInput;
  page: PageQuery;
}

export interface ListTextVersionsDependencies {
  texts: TextStore;
  /** What each version restarted, asked of the experiments (feature 042). */
  reached: ReachedByTextService;
}

export class ListTextVersionsUseCase implements UseCase<ListTextVersionsRequest, Page<TextVersionRead>> {
  readonly #deps: ListTextVersionsDependencies;

  constructor(deps: ListTextVersionsDependencies) {
    this.#deps = deps;
  }

  /** A listing cannot fail as a business outcome, so it answers the page directly (ADR-023). */
  async execute(request: ListTextVersionsRequest): Promise<Page<TextVersionRead>> {
    const key = TextKey.of(request.key);
    if (!key.ok) return { items: [] };
    const { texts, reached } = this.#deps;
    return readEach(await texts.versionsOf(undefined, key.value.record(), request.page), (version) =>
      reached.restartedBy(version),
    );
  }
}
