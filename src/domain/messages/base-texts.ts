// What the base layer must hold (feature 038; 01 §322): a text for every family that does not depend on
// the product, in every language some level supports or names as its reserve. A family that speaks of an
// attribute is sayable exactly when the product's value has prose, so it has no unconditional text and does
// not count. Without this, silence would be the normal answer for a merchant that configured nothing.
//
// It was the boot's rule, in the composition, until the texts were published by API: now it is asked when
// the seed is imported and when a language enters a level, and it has to live with its owner.
import { TextKey, type TextKeyRecord } from "./text-key.js";

export class BaseTexts {
  readonly #byLocale: ReadonlyMap<string, ReadonlySet<string>>;

  private constructor(byLocale: ReadonlyMap<string, ReadonlySet<string>>) {
    this.#byLocale = byLocale;
  }

  /** The keys the base holds a text for right now. */
  static of(keys: readonly TextKeyRecord[]): BaseTexts {
    const byLocale = new Map<string, Set<string>>();
    for (const key of keys) {
      if (key.attributeValue !== undefined) continue;
      const families = byLocale.get(key.locale) ?? new Set<string>();
      families.add(key.family);
      byLocale.set(key.locale, families);
    }
    return new BaseTexts(byLocale);
  }

  /** The unconditional families with no base text in that language; empty when the base is complete in it. */
  missingFor(locale: string): readonly string[] {
    const held = this.#byLocale.get(locale);
    return TextKey.unconditionalFamilies().filter((family) => held?.has(family) !== true);
  }
}
