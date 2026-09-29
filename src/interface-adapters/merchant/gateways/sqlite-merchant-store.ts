// The merchants on the durable store (feature 033), **and the only gateway of this repository that
// answers its reads from memory**. The decision and its limit are **ADR-041**; the reason is repeated
// here because a gateway that does not read its own table looks wrong until you know why.
//
// **What it resolves.** Every request of the SDK and of the platform resolves the merchant by the
// fingerprint of its credential **before the body is validated** (`IngestKeyResolver`,
// `PlatformKeyResolver`), and the CORS edge asks whether an origin is registered. Those are not cold
// paths: they are *the* path. Against this store a query there costs one indexed read; against a remote
// one it costs **a network round trip per request**, and that day is D-21. Choosing to query would be
// choosing to redo it.
//
// **Why it is sound, and exactly when it stops being.** It is sound because there is **one process**,
// which is the declared scope since feature 030 (**D-21**): every write of a merchant goes through this
// gateway, so the index cannot drift — it is updated in the same call that writes, and only after the
// store accepted. It stops being sound **the moment there are two processes**: the index of A does not
// see the merchant B created, so a brand-new merchant would authenticate on one node and not on the
// other. The PostgreSQL gateway has to solve that, by invalidation or by querying.
//
// **And it is not "writing twice"**, which is what feature 032 rejected for the hot state. There the
// ledger and the hot state would be **two truths** that can disagree about the same fact. Here there is
// **one** truth — the table — and the index is a view of it kept by the same operation that changes it.
// The difference is testable: if they could disagree there would be two write paths, and there are not.
import { Merchant, Origin, type MerchantRecord } from "../../../domain/merchant/index.js";
import { fromDocument, stored, toDocument, type DurableGatewayDeps } from "../../shared-kernel/index.js";
import type { MerchantDirectory, MerchantStore } from "../../../application/merchant/index.js";
import type { Page, PageQuery } from "../../../application/shared-kernel/index.js";
import type { Result, StoreUnavailable } from "../../../domain/shared-kernel/index.js";

/** The column every table of this schema keeps the record in. */
const DOCUMENT = "document";
/** What a refused write is reported as: the same word for the two, because it is the same table. */
const WRITE = "merchant";

/**
 * The index this gateway answers from. It is **injected and not imported**, because a gateway does not
 * import another gateway (ADR-013): the composition hands it the in-memory store, which already is
 * exactly this — every merchant in a map, with the four lookups over it.
 */
export interface SqliteMerchantStoreDeps extends DurableGatewayDeps {
  readonly index: MerchantStore & MerchantDirectory;
}

const INSERT = `INSERT INTO merchants (merchant_id, status, document)
  VALUES (:merchant, :status, :document)`;

const UPDATE = `UPDATE merchants
  SET status = :status, document = :document, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE merchant_id = :merchant`;

/** Oldest first, which is what `list` promises, and the `id` gives it without a column to keep in step. */
const ALL = `SELECT document FROM merchants ORDER BY id`;

const CLAIM_ORIGIN = `INSERT INTO merchant_origins (merchant_id, origin) VALUES (:merchant, :origin)`;
const RELEASE_ORIGINS = `DELETE FROM merchant_origins WHERE merchant_id = :merchant`;

export function sqliteMerchantStore(deps: SqliteMerchantStoreDeps): MerchantStore & MerchantDirectory {
  const { index } = deps;
  // The index is filled once, when the gateway is built. From here it is maintained by the writes
  // below, so nothing reads the table again for the life of the process.
  //
  // **This read is the one place where the gateway throws instead of degrading**, and that is right: it
  // happens at boot, and a server that cannot read its merchants must not start (the same rule the store
  // applies to a schema it does not expect). A write that fails later is a different fact and degrades.
  for (const row of deps.store.all(ALL)) void index.create(merchantOf(row[DOCUMENT]));

  /**
   * One path for the two writes, because they differ in a word: which statement writes the row and
   * which side of the index takes the result. **And the order is the rule of this gateway** — the index
   * is touched after the store accepted and never before, so it can only ever answer what was written.
   *
   * The merchant and its origins go in **one transaction**, which is what makes the uniqueness of an
   * origin enforceable: the row and its claims land together or not at all. A claim that collides
   * raises, the transaction rolls back, and `stored` turns that into the failure the port declares —
   * so a refused origin leaves nothing behind, not even the merchant.
   *
   * The `undefined` of `stored<undefined>` is explicit, and not decoration: this port's `Result`
   * carries `undefined` where the ledger's carries `void`, and inferring it from a block that falls
   * off the end gives `void` and does not compile.
   */
  const persisted = async (
    merchant: Merchant,
    sql: string,
    into: (m: Merchant) => Promise<unknown>,
  ): Promise<Result<undefined, StoreUnavailable>> => {
    const written = await stored<undefined>(deps, WRITE, () => {
      deps.store.transaction(() => {
        deps.store.run(sql, {
          merchant: merchant.merchantId,
          status: merchant.status,
          document: toDocument(merchant.record()),
        });
        deps.store.run(RELEASE_ORIGINS, { merchant: merchant.merchantId });
        for (const origin of merchant.origins) {
          deps.store.run(CLAIM_ORIGIN, { merchant: merchant.merchantId, origin: origin.value });
        }
      });
      return undefined;
    });
    if (written.ok) await into(merchant);
    return written;
  };

  return {
    create: (merchant) => persisted(merchant, INSERT, (m) => index.create(m)),
    update: (merchant) => persisted(merchant, UPDATE, (m) => index.update(m)),
    get: (merchantId) => index.get(merchantId),
    list: (query: PageQuery): Promise<Page<Merchant>> => index.list(query),
    ownerOfOrigin: (origin) => index.ownerOfOrigin(origin),
    isEmpty: () => index.isEmpty(),
    findByIngestKey: (fingerprint, now) => index.findByIngestKey(fingerprint, now),
    findByPlatformKey: (fingerprint, now) => index.findByPlatformKey(fingerprint, now),
    isRegisteredOrigin: (origin) => index.isRegisteredOrigin(origin),
  };
}

/**
 * The document back as the entity, **with its origins rehydrated**. That is the line where this gateway
 * would fail in the way that is hardest to find: `Origin` is a class with `equals`, `JSON.parse` returns
 * plain objects, and a merchant whose origins are plain objects lists fine, looks fine in the panel and
 * **authenticates nothing** — `allowsOrigin` throws at the CORS edge, in another request.
 *
 * The credentials come back on their own: `Credential` is a type with no methods, and the instants are
 * marked by `toDocument`, so a new `Date` field would travel without this function knowing (ADR-024).
 */
function merchantOf(document: unknown): Merchant {
  const record = fromDocument(String(document)) as StoredMerchant;
  return Merchant.rehydrate({ ...record, origins: record.origins.map((o) => Origin.rehydrate(o.value)) });
}

/**
 * The record as the document actually holds it: the origins are plain objects with a `value`, because
 * that is what `JSON.parse` gives back. Typing it as `MerchantRecord` would say they are `Origin`s and
 * hide exactly the mistake this file is about.
 */
interface StoredMerchant extends Omit<MerchantRecord, "origins"> {
  origins: readonly { value: string }[];
}
