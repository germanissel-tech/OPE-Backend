// What the catalogue of a merchant brought that OPE has no word for, on the durable store (feature 033,
// US3).
//
// **A catalogue is a replacement, so the write is a replacement: the merchant's rows go and the new set
// is written, inside one transaction.** Half a replacement leaves a set that never existed — labels of
// the old catalogue next to labels of the new one — and what an operator would read is a shop that
// stopped speaking in two ways at once.
//
// **The first sighting is what survives a label that keeps arriving**, and it is the field a replacement
// would quietly overwrite. It is what the report is for: not "this label has no translation" but "since
// when", which is the difference between a gap somebody introduced today and one that has been there
// since the integration.
//
// **This is the one write of the feature that does not report its failure**, because its port does not:
// `replace` answers nothing, and a catalogue is ingested whether or not this was written (feature 027).
// The cause still goes to the log, which is the only place it can go.
import {
  pageOf,
  fromDocument,
  stored,
  toDocument,
  type DurableGatewayDeps,
  type SqlRow,
} from "../../shared-kernel/index.js";
import type { UnmappedValueLog, UnmappedValueSighting } from "../../../application/admin/index.js";
import type { UnmappedAttributeValue } from "../../../domain/admin/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

/** The column every table of this schema keeps the record in. */
const DOCUMENT = "document";
/** What a refused write is reported as. */
const WRITE = "unmapped values";

const RELEASE = `DELETE FROM unmapped_values WHERE merchant_id = :merchant`;

const INSERT = `INSERT INTO unmapped_values (merchant_id, document) VALUES (:merchant, :document)`;

/** In the order they were written, which is oldest first by first sighting: the order the cap consumes. */
const OF_MERCHANT = `SELECT document FROM unmapped_values WHERE merchant_id = :merchant ORDER BY id`;

export interface SqliteUnmappedValuesDeps extends DurableGatewayDeps {
  /** How many the platform keeps per merchant (level 1): policy, so it arrives and is not a constant. */
  readonly kept: number;
}

const valueOf = (row: SqlRow): UnmappedAttributeValue =>
  fromDocument(String(row[DOCUMENT])) as UnmappedAttributeValue;

export function sqliteUnmappedValueLog(deps: SqliteUnmappedValuesDeps): UnmappedValueLog {
  const of = (merchantId: MerchantId): readonly UnmappedAttributeValue[] =>
    deps.store.all(OF_MERCHANT, { merchant: merchantId }).map(valueOf);
  return {
    replace: async (merchantId, seen, at) => {
      await stored<undefined>(deps, WRITE, () => {
        deps.store.transaction(() => {
          // Read before deleting, inside the transaction: what is being kept is the instant each label
          // was **first** seen, and the rows that hold it are the ones about to go.
          const before = new Map(of(merchantId).map((value) => [value.label, value]));
          deps.store.run(RELEASE, { merchant: merchantId });
          for (const value of kept(seen, { merchantId, at, before, cap: deps.kept })) {
            deps.store.run(INSERT, { merchant: merchantId, document: toDocument(value) });
          }
        });
        return undefined;
      });
      // Nothing is answered on purpose: the port promises nothing and the catalogue is already ingested.
    },
    pendingOf: (merchantId, mapped, query) => {
      // Newest first for the reader, and without what the merchant maps today: mapping a value takes it
      // off the report without republishing the catalogue, which is how an operator sees the fix landed.
      const pending = of(merchantId)
        .filter((value) => !mapped.has(value.label))
        .reverse();
      return Promise.resolve(pageOf(pending, query));
    },
  };
}

/**
 * The set that will be written: every label of this catalogue, each keeping the instant it was first
 * seen, oldest first and capped to the newest `kept`.
 *
 * The order is by first sighting and the sort is stable, so labels first seen in **this** catalogue keep
 * the catalogue's own order among themselves. The cap then takes the tail, which is the newest: a label
 * that has been reported since the integration is the one that goes when the report is full, because the
 * ones nobody has seen before are the news.
 */
interface Replacement {
  readonly merchantId: MerchantId;
  /** The instant of the catalogue being replaced with. */
  readonly at: Date;
  /** What the merchant had, by label: where the first sighting of a label that repeats comes from. */
  readonly before: ReadonlyMap<string, UnmappedAttributeValue>;
  readonly cap: number;
}

function kept(
  seen: readonly UnmappedValueSighting[],
  { merchantId, at, before, cap }: Replacement,
): readonly UnmappedAttributeValue[] {
  const values = seen.map((sighting): UnmappedAttributeValue => ({
    merchantId,
    label: sighting.label,
    products: sighting.products,
    firstSeenAt: before.get(sighting.label)?.firstSeenAt ?? at,
    lastSeenAt: at,
  }));
  values.sort((a, b) => a.firstSeenAt.getTime() - b.firstSeenAt.getTime());
  // A negative start returns them all when fewer than `cap` arrived, so no floor is needed.
  return values.slice(-cap);
}
