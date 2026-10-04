// Message corpus port (feature 027; two layers since feature 038): the curated texts in force, read
// from memory. It is asked on the critical path of a decision, so it never does network I/O
// (constitution IV) — what is in force is indexed in memory and a publication replaces the index after
// it commits.
//
// **Two layers, one question.** The base holds OPE's text for every family that does not depend on the
// product, in every supported language; a merchant's layer holds only the keys it chose to say
// differently. The lookup answers the merchant's text when it has one for the key and the language, and
// the base otherwise — inside **one** language: which language is tried first is the service's
// business, not the corpus's.
import type { CuratedText } from "../../../domain/messages/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

/** What identifies a text in the corpus: the family, what it says of the product, and the language. */
export interface TextKey {
  /** The message family: the candidate the decision plane may show. */
  family: string;
  /** The value of OPE's vocabulary the text speaks of, absent for a text that claims no attribute. */
  attributeValue?: string;
  locale: string;
}

export interface MessageCorpus {
  /** The merchant's text for that key, or the base's, or undefined when neither layer has one. */
  find(merchantId: MerchantId, key: TextKey): Promise<CuratedText | undefined>;
}
