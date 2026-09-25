// The corpus of the release, in memory (feature 027). It is read on the critical path of a
// decision, so it does no I/O: the entries are loaded and judged at startup, and this only looks
// one up. A durable store would be another gateway, with no consumer changing.
import type { MessageCorpus, TextKey } from "../../../application/messages/index.js";
import type { CuratedText } from "../../../domain/messages/index.js";

/** One text of the corpus with the key it answers to. */
export interface CorpusEntry {
  key: TextKey;
  text: CuratedText;
}

/** The separator of the lookup key: a unit separator, which no family, locale or voice may contain. */
const SEPARATOR = "\u001f";

const keyOf = ({ family, attributeValue, locale, voice }: TextKey): string =>
  [family, attributeValue ?? "", locale, voice].join(SEPARATOR);

export const memoryMessageCorpus = (entries: readonly CorpusEntry[]): MessageCorpus => {
  const byKey = new Map(entries.map((entry) => [keyOf(entry.key), entry.text]));
  return {
    find: (key: TextKey): Promise<CuratedText | undefined> => Promise.resolve(byKey.get(keyOf(key))),
  };
};
