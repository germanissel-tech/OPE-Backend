// publishText (feature 038): the next version of a base text, published by an operator instead of
// deployed. It is the publication of a level (feature 036) with a text where the content was, and the two
// things that are its own are the whole subject of the feature:
//
//   - **The scope is every merchant, so it takes an operator over every merchant**: a base text reaches
//     whoever has no text of its own for the key and the language.
//   - **The freeze is multitenant**, and «reached» is decided by the store of texts: the active experiment of
//     every merchant without its own text in force for that key and language. That question lives in
//     `ReachedByText`, which is why this use case asks it in one dependency and stays inside the six of
//     ADR-023.
import { TextVersion, type TextDraftError, type TextKeyRecord } from "../../../domain/messages/index.js";
import {
  ConfigurationFrozen,
  fail,
  ok,
  type ConfigurationReasonRequired,
  type Result,
  type StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import type { Experiment } from "../../../domain/experiment/index.js";
import type { Operator, OperatorScopeTooNarrow } from "../../../domain/operator/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { TextStore } from "../ports/text-store.js";
import type { ReachedByTextService } from "../services/reached-by-text.service.js";

export interface PublishTextRequest {
  actor: Operator;
  key: TextKeyRecord;
  text: string;
  corrective: boolean;
  /** Why the version is published, when the operator declared one; absent or not, never `undefined` by hand. */
  reason?: string | undefined;
}

export interface PublishedText {
  version: TextVersion;
  outcome: "created" | "repeated";
  /** The experiments whose measurement window this version restarted; empty unless it was corrective. */
  windowsRestarted: readonly Experiment[];
}

export type PublishTextResponse = Result<
  PublishedText,
  | OperatorScopeTooNarrow
  | ConfigurationReasonRequired
  | ConfigurationFrozen
  | TextDraftError
  | StoreUnavailable
>;

export interface PublishTextDependencies {
  texts: TextStore;
  reached: ReachedByTextService;
  clock: Clock;
}

export class PublishTextUseCase implements UseCase<PublishTextRequest, PublishTextResponse> {
  readonly #deps: PublishTextDependencies;

  constructor(deps: PublishTextDependencies) {
    this.#deps = deps;
  }

  async execute(request: PublishTextRequest): Promise<PublishTextResponse> {
    const { texts, reached, clock } = this.#deps;
    const covers = request.actor.coversEveryMerchant();
    if (!covers.ok) return fail(covers.error);
    const draft = TextVersion.draft({
      key: request.key,
      text: request.text,
      corrective: request.corrective,
      ...(request.reason === undefined ? {} : { reason: request.reason }),
      publishedAt: clock.now(),
      operatorId: request.actor.operatorId,
    });
    if (!draft.ok) return fail(draft.error);
    const inForce = await texts.inForce(undefined, draft.value.key);
    if (inForce?.sameTextAs(draft.value) === true) {
      return ok({ version: inForce, outcome: "repeated", windowsRestarted: [] });
    }
    const toRestart = await reached.by(undefined, draft.value.key);
    if (toRestart.length > 0 && !request.corrective) return fail(new ConfigurationFrozen());
    const published = await texts.publish(draft.value);
    if (!published.ok) return fail(published.error);
    // The index of the store already answers the new text (after the unit commits), so a window that
    // restarts does it over the treatment that is actually in force.
    const restarted = await reached.restart(toRestart, published.value);
    if (!restarted.ok) return fail(restarted.error);
    return ok({ version: published.value, outcome: "created", windowsRestarted: toRestart });
  }
}
