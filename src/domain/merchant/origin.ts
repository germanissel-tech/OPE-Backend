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

  equals(other: Origin): boolean {
    return this.value === other.value;
  }
}
