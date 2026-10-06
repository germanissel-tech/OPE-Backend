// publishMerchantText (feature 038): the next version of a merchant's own text, or its removal, published
// by an operator over that merchant. It is not a branch of the base publication: the scope, the layer and
// «remove» are three differences, and together they are what is its own.
//
//   - **The scope is one merchant**: the operator covers it and the merchant exists (`ScopedMerchants`).
//   - **The layer is the merchant's**, so what the version reaches is that merchant's active experiment and
//     nobody else's; the base is never asked.
//   - **Removing is a version**: one without text, in the history, after which the key resolves to the base.
//     Removing what was never published finds no version to repeat and none to create, and says so.
import {
  TextVersion,
  TextVersionNotFound,
  type TextDraftError,
  type TextKeyInput,
} from "../../../domain/messages/index.js";
import {
  fail,
  type ConfigurationReasonRequired,
  type MerchantId,
  type Result,
} from "../../../domain/shared-kernel/index.js";
import type { MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { ScopedMerchantService } from "../../merchant/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { TextStore } from "../ports/text-store.js";
import type { PublishedText } from "../published-text.js";
import type { TextPublicationError, TextPublicationService } from "../services/text-publication.service.js";

export interface PublishMerchantTextRequest {
  actor: Operator;
  merchantId: MerchantId;
  key: TextKeyInput;
  /** The text; absent to remove the merchant's text and send the key back to the base. */
  text?: string | undefined;
  corrective: boolean;
  /** Why the version is published, when the operator declared one; absent or not, never `undefined` by hand. */
  reason?: string | undefined;
}

export type PublishMerchantTextResponse = Result<
  PublishedText,
  | MerchantOutOfScope
  | MerchantNotFound
  | ConfigurationReasonRequired
  | TextDraftError
  | TextVersionNotFound
  | TextPublicationError
>;

export interface PublishMerchantTextDependencies {
  scoped: ScopedMerchantService;
  texts: TextStore;
  publications: TextPublicationService;
  clock: Clock;
}

export class PublishMerchantTextUseCase implements UseCase<
  PublishMerchantTextRequest,
  PublishMerchantTextResponse
> {
  readonly #deps: PublishMerchantTextDependencies;

  constructor(deps: PublishMerchantTextDependencies) {
    this.#deps = deps;
  }

  async execute(request: PublishMerchantTextRequest): Promise<PublishMerchantTextResponse> {
    const { scoped, texts, publications, clock } = this.#deps;
    const found = await scoped.find(request.actor, request.merchantId);
    if (!found.ok) return found;
    const draft = TextVersion.draft({
      key: request.key,
      merchantId: request.merchantId,
      text: request.text,
      corrective: request.corrective,
      reason: request.reason,
      publishedAt: clock.now(),
      operatorId: request.actor.operatorId,
    });
    if (!draft.ok) return fail(draft.error);
    if (
      draft.value.text === undefined &&
      (await texts.inForce(request.merchantId, draft.value.key)) === undefined
    ) {
      return fail(TextVersionNotFound.inForce());
    }
    return publications.publish(draft.value);
  }
}
