// publishText (feature 038): the next version of a base text, published by an operator instead of
// deployed. It is the publication of a level (feature 036) with a text where the content was, and what is
// its own is the scope: **a base text reaches every merchant without a text of its own for the key and
// the language, so it takes an operator over every merchant**. What a publication does once judged —
// repeat, freeze, restart — is the service's, shared with the merchant's publication.
import { TextVersion, type TextDraftError, type TextKeyInput } from "../../../domain/messages/index.js";
import { fail, type ConfigurationReasonRequired, type Result } from "../../../domain/shared-kernel/index.js";
import type { Operator, OperatorScopeTooNarrow } from "../../../domain/operator/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { PublishedText } from "../published-text.js";
import type { TextPublicationError, TextPublicationService } from "../services/text-publication.service.js";

export interface PublishTextRequest {
  actor: Operator;
  key: TextKeyInput;
  text: string;
  corrective: boolean;
  /** Why the version is published, when the operator declared one; absent or not, never `undefined` by hand. */
  reason?: string | undefined;
}

export type PublishTextResponse = Result<
  PublishedText,
  OperatorScopeTooNarrow | ConfigurationReasonRequired | TextDraftError | TextPublicationError
>;

export interface PublishTextDependencies {
  publications: TextPublicationService;
  clock: Clock;
}

export class PublishTextUseCase implements UseCase<PublishTextRequest, PublishTextResponse> {
  readonly #deps: PublishTextDependencies;

  constructor(deps: PublishTextDependencies) {
    this.#deps = deps;
  }

  async execute(request: PublishTextRequest): Promise<PublishTextResponse> {
    const { publications, clock } = this.#deps;
    const covers = request.actor.coversEveryMerchant();
    if (!covers.ok) return fail(covers.error);
    const draft = TextVersion.draft({
      key: request.key,
      text: request.text,
      corrective: request.corrective,
      reason: request.reason,
      publishedAt: clock.now(),
      operatorId: request.actor.operatorId,
    });
    return draft.ok ? publications.publish(draft.value) : fail(draft.error);
  }
}
