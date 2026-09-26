// How a record travels into a durable store and comes back the same (FR-001 of feature 030). The
// ledger keeps columns only for what a read searches by and the rest as one document, so this is
// the whole translation: every durable gateway writes with `toDocument` and reads with
// `fromDocument`, and none of them writes its own.
//
// **Dates are marked, and that is the point.** JSON turns a `Date` into a string and cannot turn
// it back, so something has to say which strings were instants. Two ways were considered:
//
//   - reviving by field name, which puts the shape of the domain inside the gateway — and then a
//     new `Date` field comes back a string, silently, in whatever read happens to touch it;
//   - reviving any string that looks like an instant, which is the same guess made blindly: a
//     version or a locale that happened to match would come back a `Date`.
//
// Marking the value avoids both: a new field of the domain travels with no gateway knowing it
// exists, and nothing is decided by how a string looks. The document is ours and nobody else
// parses it, so the mark costs nothing outside these two functions.

/** How an instant travels: a one-field object nothing else in the domain has. */
const DATE_KEY = "$date";

interface MarkedDate {
  readonly [DATE_KEY]: string;
}

/**
 * The record as one string. `JSON.stringify` hands a replacer the value **already converted** —
 * a `Date` has arrived as its ISO string by then — so the original is read back off the container
 * through `this`, which is the only place the type is still there. A `Date` at the root has no
 * container, so it is marked before the walk starts.
 */
export function toDocument(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(mark(value));
  // `this` is the container the key belongs to, and `JSON.stringify` only ever passes an object
  // or an array — the root arrives wrapped in one too. So it is typed rather than guarded: a
  // guard for a case that cannot happen is a branch no test can take.
  return JSON.stringify(
    value,
    function (this: Record<string, unknown>, key: string, converted: unknown): unknown {
      const original: unknown = this[key];
      return original instanceof Date ? mark(original) : converted;
    },
  );
}

/**
 * The record as it was written. It comes back `unknown` and its own gateway narrows it: the
 * document was written from an entity this code had already judged, and an entity is rehydrated
 * without being judged again (ADR-024). Validating the shape here would be the domain's rules
 * written a second time, in the one place that cannot keep them in step.
 */
export function fromDocument(text: string): unknown {
  return JSON.parse(text, (_key: string, value: unknown): unknown =>
    isMarkedDate(value) ? new Date(value[DATE_KEY]) : value,
  );
}

const mark = (date: Date): MarkedDate => ({ [DATE_KEY]: date.toISOString() });

/**
 * Exactly one field, and it is the mark: nothing the domain carries looks like this.
 *
 * **It reads the field instead of asking what kind of thing it is**, and each of the two
 * remaining checks is one a value can actually fail. Asking `typeof value === "object"` first was
 * a guard for the compiler that no input could distinguish — a number, a string and an array all
 * answer `undefined` to `[DATE_KEY]` — and comparing the *name* of the single field said nothing
 * either: if there is one key and its value is a string under `DATE_KEY`, that key **is**
 * `DATE_KEY`. Both were found by mutants nothing could kill.
 *
 * `null` is the one that has to be asked, because reading any field of it throws — and a record
 * with an absent value is most records.
 */
function isMarkedDate(value: unknown): value is MarkedDate {
  if (value === null) return false;
  const marked = value as Partial<MarkedDate>;
  return typeof marked[DATE_KEY] === "string" && Object.keys(marked).length === 1;
}
