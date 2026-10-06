// listTextVersions (feature 038, US5): the history of a base key, newest first and paginated — what makes
// the text an intervention stamped **explainable** after it was corrected. Nothing is ever deleted from a
// history, so the first version is the seed's and the rest an operator's.
//
// **It does not take an operator's scope**: the base is served to every merchant, so there is no merchant
// to check against; the capability `texts:read` of the admin consumer is compared at the edge (ADR-020).
// A key outside the vocabulary has no history: the page is empty, not a refusal.
import { TextKey, type TextKeyInput, type TextVersion } from "../../../domain/messages/index.js";
import type { Page, PageQuery, UseCase } from "../../shared-kernel/index.js";
import type { TextStore } from "../ports/text-store.js";

export interface ListTextVersionsRequest {
  key: TextKeyInput;
  page: PageQuery;
}

export interface ListTextVersionsDependencies {
  texts: TextStore;
}

export class ListTextVersionsUseCase implements UseCase<ListTextVersionsRequest, Page<TextVersion>> {
  readonly #deps: ListTextVersionsDependencies;

  constructor(deps: ListTextVersionsDependencies) {
    this.#deps = deps;
  }

  /** A listing cannot fail as a business outcome, so it answers the page directly (ADR-023). */
  execute(request: ListTextVersionsRequest): Promise<Page<TextVersion>> {
    const key = TextKey.of(request.key);
    if (!key.ok) return Promise.resolve({ items: [] });
    return this.#deps.texts.versionsOf(undefined, key.value.record(), request.page);
  }
}
