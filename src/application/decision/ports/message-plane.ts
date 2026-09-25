// Message plane port (01-arquitectura-mvp.md §322; feature 027): which of the candidates the
// dominant barrier offers can actually be said, and with what text. The decision plane is the
// owner of this contract; the messages module implements it and the composition binds them, so
// the plane never depends on the corpus (no cycle in the context map).
//
// **A family without a text is not a candidate** (01 §322), so this is asked *before* the quality
// gate judges: what comes back is what may be judged, in the order it was given, which is the
// order of the incentive ladder.
import type { Candidate, Sayable } from "../../../domain/selection/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export interface MessageRequest {
  merchantId: MerchantId;
  /** The candidates of the dominant barrier, in ladder order. */
  candidates: readonly Candidate[];
  /** Language of the page in focus, when the SDK read one; the merchant's reserve language answers for the rest. */
  locale?: string;
  /** The attributes of the product in focus, as the platform exposes them: the corpus maps them to what OPE can say. */
  attributes: ReadonlyMap<string, string>;
}

export interface MessagePlane {
  /** What of these candidates can be said, in the order given; empty when none can. */
  sayable(request: MessageRequest): Promise<readonly Sayable[]>;
}
