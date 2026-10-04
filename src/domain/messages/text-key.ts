// The key of a text (feature 038): which family, what it says of the product, and in which language.
//
// **A key is never created by the API.** Families and attribute values are OPE's closed vocabularies
// (ADR-036): a text is published *for* a key the vocabulary already has, and a key outside it is refused
// naming the part. What is open is the language, by shape, because a language exists as soon as something
// names it — a text, or a level that supports it.
//
// The layer (the base, or a merchant) is not part of the key: it is part of the publication. One key, two
// layers, and the corpus answers the merchant's layer before the base inside one language.
import { CANDIDATES } from "../selection/index.js";
import { LOCALE_PATTERN, fail, ok, type Result } from "../shared-kernel/index.js";
import { ATTRIBUTE_VALUES } from "./attribute-values.js";
import { TextKeyUnknown } from "./errors.js";

/** The plain data of a key, as a store carries it: the value is there or it is not, never `undefined`. */
export interface TextKeyRecord {
  family: string;
  /** The value of OPE's vocabulary the text speaks of; only on a family that speaks of the product. */
  attributeValue?: string;
  locale: string;
}

/**
 * A key as the API declares it, before it is judged: the value may arrive as `undefined`, which is what a
 * body without it reads as. The guard that turns `undefined` into «not there» lives once, in `of`.
 */
export interface TextKeyInput {
  family: string;
  attributeValue?: string | undefined;
  locale: string;
}

const ALL_CANDIDATES = Object.values(CANDIDATES).flat();

/** Every family the plane may choose, and whether its text speaks of an attribute of the product. */
const SPEAKS_OF_ATTRIBUTE: ReadonlyMap<string, boolean> = new Map(
  ALL_CANDIDATES.map((candidate) => [
    candidate.candidateId,
    candidate.claims.some((claim) => claim.kind === "product-attribute"),
  ]),
);

const VALUES: ReadonlySet<string> = new Set<string>(ATTRIBUTE_VALUES);

/** What stands for an absent attribute value wherever a key is written as one string. */
const NO_VALUE = "-";

export class TextKey implements TextKeyRecord {
  readonly family: string;
  readonly attributeValue?: string;
  readonly locale: string;

  private constructor(record: TextKeyInput) {
    this.family = record.family;
    if (record.attributeValue !== undefined) this.attributeValue = record.attributeValue;
    this.locale = record.locale;
  }

  /** A key as the API declares it: judged against the vocabularies, naming the part that is not in them. */
  static of(record: TextKeyInput): Result<TextKey, TextKeyUnknown> {
    const speaks = SPEAKS_OF_ATTRIBUTE.get(record.family);
    if (speaks === undefined) return fail(new TextKeyUnknown("family", record.family));
    if (record.attributeValue === undefined) {
      if (speaks) return fail(new TextKeyUnknown("attributeValue", NO_VALUE));
    } else if (!speaks || !VALUES.has(record.attributeValue)) {
      return fail(new TextKeyUnknown("attributeValue", record.attributeValue));
    }
    if (!LOCALE_PATTERN.test(record.locale)) return fail(new TextKeyUnknown("locale", record.locale));
    return ok(new TextKey(record));
  }

  /** A key a store already kept: not re-judged (ADR-024). */
  static rehydrate(record: TextKeyRecord): TextKey {
    return new TextKey(record);
  }

  /** Every family that does not speak of the product: the ones the base must have a text for in every supported language. */
  static unconditionalFamilies(): readonly string[] {
    return ALL_CANDIDATES.filter((candidate) => SPEAKS_OF_ATTRIBUTE.get(candidate.candidateId) === false).map(
      (candidate) => candidate.candidateId,
    );
  }

  equals(other: TextKey): boolean {
    return this.toString() === other.toString();
  }

  /** The key as one string, the same wherever a text is quoted: `family/value-or-dash/locale`. */
  toString(): string {
    return [this.family, this.attributeValue ?? NO_VALUE, this.locale].join("/");
  }

  record(): TextKeyRecord {
    return {
      family: this.family,
      ...(this.attributeValue === undefined ? {} : { attributeValue: this.attributeValue }),
      locale: this.locale,
    };
  }
}
