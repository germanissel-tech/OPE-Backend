// Text store port (feature 038): the versions of every text, in the base layer and in each merchant's,
// numbered by the store itself — the next number **of that key and layer** is assigned and the version
// recorded in one step, so two operators publishing at once never share a number. Nothing is ever
// overwritten; removing a merchant's text is a version too. Every write returns `Result` (ADR-021):
// `StoreUnavailable`, never a throw.
//
// **It also answers what the corpus asks** (`MessageCorpus`), from memory and on the critical path: the
// text in force of a key in a layer. A store that answered that from its table would put a read in every
// decision, so the gateway keeps what is in force indexed and the writes maintain it (ADR-041).
import type { TextDraft, TextKeyRecord, TextVersion } from "../../../domain/messages/index.js";
import type { MerchantId, Result, StoreUnavailable } from "../../../domain/shared-kernel/index.js";
import type { Page, PageQuery } from "../../shared-kernel/index.js";

/** A layer of texts: the base, or a merchant's. */
export type TextLayer = MerchantId | undefined;

export interface TextStore {
  /** Records the draft as the next version of its key and layer, and answers it numbered. */
  publish(draft: TextDraft): Promise<Result<TextVersion, StoreUnavailable>>;
  /** The version in force of a key in a layer, removed ones included; undefined when the layer never held it. */
  inForce(layer: TextLayer, key: TextKeyRecord): Promise<TextVersion | undefined>;
  /** Every key the base holds a text in force for (not removed): what completeness is judged on. */
  baseKeys(): Promise<readonly TextKeyRecord[]>;
  /** The unconditional families the base holds no text for in `locale`, in the order of the vocabulary. */
  missingFor(locale: string): Promise<readonly string[]>;
  /** The versions of a key in a layer, newest first. */
  versionsOf(layer: TextLayer, key: TextKeyRecord, query: PageQuery): Promise<Page<TextVersion>>;
  /** One version of a key in a layer, as it was published, or undefined when there is no such number. */
  versionOf(layer: TextLayer, key: TextKeyRecord, version: number): Promise<TextVersion | undefined>;
  /** Whether the store holds any text at all: the seed is imported only into an empty one. */
  isEmpty(): Promise<boolean>;
}
