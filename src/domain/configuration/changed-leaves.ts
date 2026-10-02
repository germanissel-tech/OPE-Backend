// What a level change touches, and whether a merchant's declaration already covers it (feature 036,
// FR-007). It is the piece that decides which experiments a publication reaches.
//
// **The unit is the leaf and not the field**, and that is the whole reason this type exists. Six of the ten
// treatment fields merge key by key (`PolicyInput.merge`) and `decisionPolicy.evidence` one level deeper
// still, so a merchant can declare `decisionPolicy.threshold` and not `decisionPolicy.readingSeconds`: for
// the first one it wins, for the second the level does. Asking the question by field would call that
// merchant covered and leave its measurement window running over a treatment that changed — the expensive
// mistake of this feature, and the one `tests/unit/domain/configuration/changed-leaves.test.ts` pins.
//
// **An array is one leaf.** The merge copies a value whole, so declaring `barriers` replaces the list; there
// is no such thing as covering half of it.

/** A value of a configuration document: an object of them, an array, or something that ends the walk. */
type Content = Record<string, unknown>;

/**
 * Whether `value` is an object whose keys the merge walks into.
 *
 * **The exception below is a false survivor of the runner, measured and not assumed** (ADR-016). Stryker
 * classifies this body as static —the seed of the boot walks it from a `beforeEach`, outside any test— and
 * then cannot activate it per test, so it reports it as survived against the 52 tests that cover it.
 * Replacing the body with `true` by hand fails 14 of the 16 cases of
 * `tests/unit/domain/configuration/changed-leaves.test.ts`: every string becomes walkable and the walk
 * recurses forever. The mutant is dead; what cannot judge it is the tool.
 */
const walkable = (value: unknown): value is Content =>
  // Stryker disable next-line ConditionalExpression: static mutant the runner cannot activate; see above
  value !== null && typeof value === "object" && !Array.isArray(value);

/** The canonical text of a leaf, so two equal values compare equal whatever their key order. */
function canonical(value: unknown): string {
  // **Named rather than left to `JSON.stringify`**, which answers an `undefined` with nothing at all —
  // its type says `string` and its runtime disagrees. A leaf inside an array can hold one, and two
  // contents that differ in it are not equal.
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (walkable(value)) {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Every leaf of a content, by the path the merge would reach it at. */
function leavesOf(content: Content, prefix: string, into: Map<string, string>): void {
  for (const [key, value] of Object.entries(content)) {
    if (value === undefined) continue;
    const path = prefix === "" ? key : `${prefix}.${key}`;
    if (walkable(value)) leavesOf(value, path, into);
    else into.set(path, canonical(value));
  }
}

/** Whether `declared` gives a value at `path`, walking the same way the merge does. */
function declares(declared: Content, path: string): boolean {
  let at: unknown = declared;
  for (const key of path.split(".")) {
    if (!walkable(at)) return false;
    at = at[key];
  }
  return at !== undefined;
}

export class ChangedLeaves {
  readonly #paths: readonly string[];

  private constructor(paths: readonly string[]) {
    this.#paths = paths;
  }

  /**
   * The leaves whose value differs between two contents of the same level, in a stable order.
   *
   * A leaf that appears in one and not the other counts as changed: for whoever resolves against this
   * level, a value that was not there and now is —or the other way round— is a different treatment.
   */
  static between(from: object, to: object): ChangedLeaves {
    const before = new Map<string, string>();
    const after = new Map<string, string>();
    leavesOf(from as Content, "", before);
    leavesOf(to as Content, "", after);
    const paths = [...new Set([...before.keys(), ...after.keys()])]
      .filter((path) => before.get(path) !== after.get(path))
      .sort((a, b) => a.localeCompare(b));
    return new ChangedLeaves(paths);
  }

  /** The paths that changed, for whoever reports or logs them. */
  paths(): readonly string[] {
    return this.#paths;
  }

  /**
   * The changed leaves that live under one of these fields, and nothing else.
   *
   * It exists because not every value of a level is treatment: level 1 holds five fields that decide what is
   * counted and five that are operational, and only the first five can reach a measurement in course. The
   * comparison is by the **first segment** of the path, so a field and everything under it travel together.
   */
  under(fields: readonly string[]): ChangedLeaves {
    return new ChangedLeaves(this.#paths.filter((path) => fields.includes(path.split(".")[0] ?? path)));
  }

  none(): boolean {
    return this.#paths.length === 0;
  }

  /**
   * Whether what a merchant declares already wins for **every** leaf that changed — and therefore that
   * this change does not reach its treatment.
   *
   * Nothing changed is covered by anyone, which is what keeps a repeated publication from restarting
   * anything.
   */
  coveredBy(declared: object): boolean {
    return this.#paths.every((path) => declares(declared as Content, path));
  }
}
