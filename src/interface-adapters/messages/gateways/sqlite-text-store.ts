// The texts on the durable store (feature 038): one row per published version of each key in each layer,
// never overwritten, never deleted — and **the corpus the decision plane reads, answered from memory**.
//
// **Where the next number comes from is half the design.** `MAX(version) + 1` **of that layer and key**,
// read and written inside one transaction, which is the step `01 §6` asks for: nothing asynchronous
// happens between deciding the number and taking it. The unique index on the whole key turns a lost race
// into a refused write instead of a silent overwrite.
//
// **The other half is the index of what is in force.** The corpus is asked on the critical path of every
// decision (constitution IV), so this gateway never reads its table to answer it: it loads what is in force
// once, when it is built, and the writes below maintain it **after the store accepted and after a unit of
// work commits** (ADR-041, the pattern of merchants and experiments). A reverted publication therefore
// cannot leave the index answering a text the table does not have. The same limit applies: it is sound
// while there is one process (D-21).
import {
  BaseTexts,
  TextVersion,
  type CuratedText,
  type TextDraft,
  type TextKeyRecord,
  type TextVersionRecord,
} from "../../../domain/messages/index.js";
import {
  fetched,
  fromDocument,
  pagedByVersion,
  stored,
  toDocument,
  type DurableGatewayDeps,
  type SqlParams,
  type SqlRow,
} from "../../shared-kernel/index.js";
import type { MessageCorpus, TextLayer, TextStore } from "../../../application/messages/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

/** The column every table of this schema keeps the record in. */
const DOCUMENT = "document";
/** What a refused write is reported as. */
const WRITE = "text";
/** The sentinel of the base layer in the table: a name no merchant identifier takes. */
const BASE_LAYER = "base";
/** The sentinel of an absent attribute value in the table (a unique index treats NULLs as distinct). */
const NO_VALUE = "";
/** The separator of the index key: a unit separator, which no part of a key may contain. */
const SEPARATOR = "\u001f";

/** The number this key's next version takes in its layer. A key with no versions starts at one. */
const NEXT_VERSION = `SELECT COALESCE(MAX(version), 0) + 1 AS next FROM texts
  WHERE layer = :layer AND family = :family AND attribute_value = :value AND locale = :locale`;

const INSERT = `INSERT INTO texts (layer, family, attribute_value, locale, version, document)
  VALUES (:layer, :family, :value, :locale, :version, :document)`;

/** Every version there is, in key order and then by number: what is in force is the last of each key. */
const ALL = `SELECT document FROM texts ORDER BY layer, family, attribute_value, locale, version`;

/** Newest first, resuming below the version the cursor names: the key does not move when one is added. */
const VERSIONS = `SELECT version, document FROM texts
  WHERE layer = :layer AND family = :family AND attribute_value = :value AND locale = :locale
    AND version < :below
  ORDER BY version DESC LIMIT :limit`;

const ONE = `SELECT document FROM texts
  WHERE layer = :layer AND family = :family AND attribute_value = :value AND locale = :locale
    AND version = :version`;

const versionOf = (row: SqlRow): TextVersion =>
  TextVersion.rehydrate(fromDocument(String(row[DOCUMENT])) as TextVersionRecord);

const layerOf = (layer: TextLayer): string => layer ?? BASE_LAYER;

const keyParams = (layer: TextLayer, key: TextKeyRecord): SqlParams => ({
  layer: layerOf(layer),
  family: key.family,
  value: key.attributeValue ?? NO_VALUE,
  locale: key.locale,
});

const slot = (layer: TextLayer, key: TextKeyRecord): string =>
  [layerOf(layer), key.family, key.attributeValue ?? NO_VALUE, key.locale].join(SEPARATOR);

export function sqliteTextStore(deps: DurableGatewayDeps): TextStore & MessageCorpus {
  // What is in force, by layer and key. Filled once, when the gateway is built, and maintained by the
  // writes below. **It does not wait its turn** (feature 034): at boot nothing else runs, so no unit of
  // work can be open. Against a store it cannot read this throws, and at boot that is the right answer: a
  // server that cannot read its texts would say nothing to anybody, and nothing would say so.
  const inForce = new Map<string, TextVersion>();
  for (const row of deps.store.all(ALL)) {
    const version = versionOf(row);
    inForce.set(slot(version.merchantId, version.key.record()), version);
  }

  const textOf = (layer: TextLayer, key: TextKeyRecord): CuratedText | undefined =>
    inForce.get(slot(layer, key))?.text;

  return {
    publish: async (draft: TextDraft) => {
      const written = await stored(deps, WRITE, () =>
        deps.store.transaction(() => {
          const params = keyParams(draft.merchantId, draft.key);
          const next = Number(deps.store.all(NEXT_VERSION, params)[0]?.["next"]);
          const numbered = TextVersion.numbered(draft, next);
          deps.store.run(INSERT, { ...params, version: next, document: toDocument(numbered.record()) });
          return numbered;
        }),
      );
      // After the store accepted — and inside a unit of work that means after it commits (feature 034): the
      // index is a view of the table, and a reverted publication must not leave it answering a text.
      if (written.ok) {
        const numbered = written.value;
        deps.store.committed(() => inForce.set(slot(numbered.merchantId, numbered.key.record()), numbered));
      }
      return written;
    },
    inForce: (layer, key) => Promise.resolve(inForce.get(slot(layer, key))),
    baseKeys: () =>
      Promise.resolve(
        [...inForce.values()]
          .filter((version) => version.merchantId === undefined && !version.isRemoved())
          .map((version) => version.key.record()),
      ),
    async missingFor(locale) {
      return BaseTexts.of(await this.baseKeys()).missingFor(locale);
    },
    versionsOf: (layer, key, query) =>
      pagedByVersion(deps, { sql: VERSIONS, params: keyParams(layer, key), itemOf: versionOf }, query),
    versionOf: (layer, key, version) =>
      fetched(deps, () => {
        const row = deps.store.all(ONE, { ...keyParams(layer, key), version })[0];
        return row === undefined ? undefined : versionOf(row);
      }),
    isEmpty: () => Promise.resolve(inForce.size === 0),
    // The merchant's layer first and the base second, inside the one language the key names; a removed
    // text has no `text`, so a merchant that went back to the base falls through here by itself.
    find: (merchantId: MerchantId, key) => Promise.resolve(textOf(merchantId, key) ?? textOf(undefined, key)),
  };
}
