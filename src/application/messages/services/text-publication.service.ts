// The publication of a judged draft in its layer (feature 038): what the two publications share once each
// has settled its scope and judged its draft. A text identical to the version in force repeats it; what
// the version reaches freezes it without a reason and restarts with one; and the index of the store answers
// the new text before any window restarts over it. As a service, each use case asks it in one dependency
// (ADR-023) and the two never meet.
import {
  ConfigurationFrozen,
  fail,
  ok,
  type Result,
  type StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import type { TextDraft } from "../../../domain/messages/index.js";
import type { TextStore } from "../ports/text-store.js";
import type { PublishedText } from "../published-text.js";
import type { ReachedByTextService } from "./reached-by-text.service.js";

export type TextPublicationError = ConfigurationFrozen | StoreUnavailable;

export interface TextPublicationService {
  /** The draft as the next version of its key in its layer, or the version in force it repeats. */
  publish(draft: TextDraft): Promise<Result<PublishedText, TextPublicationError>>;
}

export interface TextPublicationDependencies {
  texts: TextStore;
  reached: ReachedByTextService;
}

export class TextPublications implements TextPublicationService {
  readonly #deps: TextPublicationDependencies;

  constructor(deps: TextPublicationDependencies) {
    this.#deps = deps;
  }

  async publish(draft: TextDraft): Promise<Result<PublishedText, TextPublicationError>> {
    const { texts, reached } = this.#deps;
    const inForce = await texts.inForce(draft.merchantId, draft.key);
    if (inForce?.sameTextAs(draft) === true) {
      return ok({ version: inForce, outcome: "repeated", windowsRestarted: [] });
    }
    const toRestart = await reached.by(draft.merchantId, draft.key);
    if (toRestart.length > 0 && !draft.corrective) return fail(new ConfigurationFrozen());
    const published = await texts.publish(draft);
    if (!published.ok) return published;
    // The index of the store already answers the new text (after the unit commits), so a window that
    // restarts does it over the treatment that is actually in force.
    const restarted = await reached.restart(toRestart, published.value);
    return restarted.ok
      ? ok({ version: published.value, outcome: "created", windowsRestarted: toRestart })
      : restarted;
  }
}
