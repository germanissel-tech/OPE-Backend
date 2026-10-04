// In-memory text store (feature 038): the versions of every key in every layer, numbered as they are
// published — the number is the size of the list of **that key and layer** plus one, assigned and written
// without an await in between (01 §6). Nothing is overwritten. It is also the corpus: what is in force is
// the last version of each list, and a merchant's layer is asked before the base inside one language.
import { TextVersion, type CuratedText, type TextKeyRecord } from "../../../domain/messages/index.js";
import { ok, type MerchantId } from "../../../domain/shared-kernel/index.js";
import { pageOf } from "../../shared-kernel/index.js";
import type { MessageCorpus, TextLayer, TextStore } from "../../../application/messages/index.js";

/** The separator of the lookup key: a unit separator, which no family, value, locale or merchant may contain. */
const SEPARATOR = "\u001f";

/** The base layer under one name, so the map has a single kind of key. */
const BASE = "";

const slot = (layer: TextLayer, key: TextKeyRecord): string =>
  [layer ?? BASE, key.family, key.attributeValue ?? "", key.locale].join(SEPARATOR);

export function memoryTextStore(): TextStore & MessageCorpus {
  const history = new Map<string, TextVersion[]>();
  const versionsOf = (layer: TextLayer, key: TextKeyRecord): TextVersion[] =>
    history.get(slot(layer, key)) ?? [];
  const inForce = (layer: TextLayer, key: TextKeyRecord): TextVersion | undefined =>
    versionsOf(layer, key).at(-1);
  const textOf = (layer: TextLayer, key: TextKeyRecord): CuratedText | undefined => inForce(layer, key)?.text;

  return {
    publish(draft) {
      const versions = versionsOf(draft.merchantId, draft.key);
      const numbered = TextVersion.numbered(draft, versions.length + 1);
      history.set(slot(draft.merchantId, draft.key), [...versions, numbered]);
      return Promise.resolve(ok(numbered));
    },
    inForce(layer, key) {
      return Promise.resolve(inForce(layer, key));
    },
    baseKeys() {
      const keys: TextKeyRecord[] = [];
      for (const versions of history.values()) {
        const last = versions.at(-1);
        if (last !== undefined && last.merchantId === undefined && !last.isRemoved())
          keys.push(last.key.record());
      }
      return Promise.resolve(keys);
    },
    versionsOf(layer, key, query) {
      return Promise.resolve(pageOf([...versionsOf(layer, key)].reverse(), query));
    },
    versionOf(layer, key, version) {
      return Promise.resolve(versionsOf(layer, key).find((published) => published.version === version));
    },
    isEmpty() {
      return Promise.resolve(history.size === 0);
    },
    // The merchant's layer first and the base second, inside the one language the key names: which language
    // is tried first is the service's business.
    find(merchantId: MerchantId, key) {
      return Promise.resolve(textOf(merchantId, key) ?? textOf(undefined, key));
    },
  };
}
