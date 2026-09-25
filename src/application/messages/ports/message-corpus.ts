// Message corpus port (feature 027): the curated texts of the release, read from memory. It is
// asked on the critical path of a decision, so it never does network I/O (constitution: no network
// I/O on the decision path) — the corpus is loaded at startup and its invariants judged there.
import type { CuratedText } from "../../../domain/messages/index.js";
import type { Voice } from "../../../domain/shared-kernel/index.js";

/** What identifies a text in the corpus: the family, what it says of the product, the language and the voice. */
export interface TextKey {
  /** The message family: the candidate the decision plane may show. */
  family: string;
  /** The value of OPE's vocabulary the text speaks of, absent for a text that claims no attribute. */
  attributeValue?: string;
  locale: string;
  voice: Voice;
}

export interface MessageCorpus {
  /** The text for that key, or undefined when the corpus has none. */
  find(key: TextKey): Promise<CuratedText | undefined>;
}
