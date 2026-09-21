// The anchor map of a merchant (01 §3.1.1; ADR-031): where the SDK renders each semantic anchor
// in the store, as CSS selectors tried in order. Level 3 only — it has no default: an anchor
// absent here resolves by the SDK's own chain, and the diagnostics say when it does not.
import { ANCHORS, fail, ok, type Anchor, type Result } from "../shared-kernel/index.js";
import { InvalidConfigurationValue } from "./errors.js";

export interface AnchorSelectors {
  selectors: readonly string[];
}

export type AnchorMapRecord = Partial<Readonly<Record<Anchor, AnchorSelectors>>>;

export class AnchorMap {
  readonly #byAnchor: ReadonlyMap<Anchor, readonly string[]>;

  private constructor(byAnchor: ReadonlyMap<Anchor, readonly string[]>) {
    this.#byAnchor = byAnchor;
  }

  /** Every anchor of the vocabulary, every selector list non-empty, every selector a non-blank string. */
  static of(record: AnchorMapRecord, at = "anchors"): Result<AnchorMap, InvalidConfigurationValue> {
    const byAnchor = new Map<Anchor, readonly string[]>();
    for (const [key, value] of Object.entries(record)) {
      if (!(ANCHORS as readonly string[]).includes(key)) {
        return fail(new InvalidConfigurationValue(`${at}.${key}`, `must be one of ${ANCHORS.join(", ")}`));
      }
      if (value.selectors.length === 0) {
        return fail(new InvalidConfigurationValue(`${at}.${key}.selectors`, "must not be empty"));
      }
      const blank = value.selectors.findIndex((s) => s.trim() === "");
      if (blank >= 0) {
        return fail(new InvalidConfigurationValue(`${at}.${key}.selectors[${blank}]`, "must not be blank"));
      }
      byAnchor.set(key as Anchor, [...value.selectors]);
    }
    return ok(new AnchorMap(byAnchor));
  }

  static rehydrate(record: AnchorMapRecord): AnchorMap {
    const byAnchor = new Map<Anchor, readonly string[]>();
    for (const [key, value] of Object.entries(record)) byAnchor.set(key as Anchor, [...value.selectors]);
    return new AnchorMap(byAnchor);
  }

  selectorsOf(anchor: Anchor): readonly string[] | undefined {
    return this.#byAnchor.get(anchor);
  }

  record(): AnchorMapRecord {
    const record: Partial<Record<Anchor, AnchorSelectors>> = {};
    for (const [anchor, selectors] of this.#byAnchor) record[anchor] = { selectors: [...selectors] };
    return record;
  }
}
