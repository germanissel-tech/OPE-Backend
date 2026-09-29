// Origin (ADR-014, ADR-024): `scheme://host[:port]`, no path, normalised once when parsed so
// every comparison is by canonical value. Registered origins are parsed when the Merchant is
// built; the Origin header of a request is parsed when it is checked.
const ORIGIN_PATTERN = /^([a-z][a-z0-9+.-]*):\/\/([^/?#\s]+)$/i;

export class Origin {
  /** Canonical form: lowercase scheme and authority, no trailing slash. */
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /** The canonical origin of `text`, or undefined when it is not `scheme://host[:port]`. */
  static parse(text: string): Origin | undefined {
    const match = ORIGIN_PATTERN.exec(text.trim());
    if (!match) return undefined;
    const [, scheme = "", authority = ""] = match;
    return new Origin(`${scheme.toLowerCase()}://${authority.toLowerCase()}`);
  }

  /**
   * An origin a store already kept, **without judging it again** (ADR-024). It exists because
   * `JSON.parse` returns plain objects and an origin that comes back as one has no `equals`: a merchant
   * read from the store would list fine and authenticate nothing.
   *
   * It does **not** call `parse`: what was recorded was canonical when it was parsed the first time, and
   * re-parsing here would be the creation rule written twice — in the one place that cannot be kept in
   * step with it.
   */
  static rehydrate(value: string): Origin {
    return new Origin(value);
  }

  equals(other: Origin): boolean {
    return this.value === other.value;
  }
}
