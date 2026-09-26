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
  return JSON.stringify(value, function (this: unknown, key: string, converted: unknown): unknown {
    const original: unknown = isObject(this) ? this[key] : undefined;
    return original instanceof Date ? mark(original) : converted;
  });
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

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Exactly one field, and it is the mark: nothing the domain carries looks like this. */
function isMarkedDate(value: unknown): value is MarkedDate {
  if (!isObject(value) || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 1 && keys[0] === DATE_KEY && typeof value[DATE_KEY] === "string";
}
