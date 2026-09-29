// The published configuration on the durable store (feature 033, US2): one row per version, never
// overwritten, never deleted.
//
// **The effective version is the highest one and there is no flag saying so.** A `current` column would
// be a second place stating what the number already states, and two places can disagree — the failure
// then is a merchant served a configuration nobody published last.
//
// **Where the next number comes from is the whole design.** In memory it is the size of a list; here it
// is `MAX(version) + 1` of the merchant, read and written **inside one transaction**, which is the step
// `01 §6` asks for: nothing asynchronous happens between deciding the number and taking it. The unique
// index on `(merchant_id, version)` is what makes a lost race a refused write instead of a silent
// overwrite — and it is also what would catch a gateway that kept a counter of its own, which is the
// mistake this file exists to not make: such a counter starts at zero on the next boot and renumbers a
// history that is supposed to be immutable.
//
// Reads go to the table, and they are cold on purpose: the service resolves the effective configuration
// of a merchant once and serves it from memory (`Configurations`), so `latestOf` is asked once per
// merchant per process and again when something is published. That is why this gateway keeps no index,
// unlike the merchants' (research R-02).
import {
  MerchantConfigurationVersion,
  type MerchantConfigurationVersionRecord,
} from "../../../domain/configuration/index.js";
import {
  descending,
  fromDocument,
  pageTo,
  stored,
  toDocument,
  type DurableGatewayDeps,
  type SqlRow,
} from "../../shared-kernel/index.js";
import type { ConfigurationStore } from "../../../application/configuration/index.js";

/** The column every table of this schema keeps the record in. */
const DOCUMENT = "document";
/** What a refused write is reported as. */
const WRITE = "configuration";

/** The number this merchant's next version takes. A merchant with no versions starts at one. */
const NEXT_VERSION = `SELECT COALESCE(MAX(version), 0) + 1 AS next
  FROM merchant_configurations WHERE merchant_id = :merchant`;

const INSERT = `INSERT INTO merchant_configurations (merchant_id, version, document)
  VALUES (:merchant, :version, :document)`;

const LATEST = `SELECT document FROM merchant_configurations
  WHERE merchant_id = :merchant ORDER BY version DESC LIMIT 1`;

/** Newest first, resuming below the version the cursor names: the key does not move when one is added. */
const VERSIONS = `SELECT version, document FROM merchant_configurations
  WHERE merchant_id = :merchant AND version < :below
  ORDER BY version DESC LIMIT :limit`;

const versionOf = (row: SqlRow): MerchantConfigurationVersion =>
  MerchantConfigurationVersion.rehydrate(
    fromDocument(String(row[DOCUMENT])) as MerchantConfigurationVersionRecord,
  );

export function sqliteConfigurationStore(deps: DurableGatewayDeps): ConfigurationStore {
  return {
    publish: (draft) =>
      stored(deps, WRITE, () =>
        deps.store.transaction(() => {
          const next = Number(deps.store.all(NEXT_VERSION, { merchant: draft.merchantId })[0]?.["next"]);
          const numbered = MerchantConfigurationVersion.numbered(draft, next);
          deps.store.run(INSERT, {
            merchant: draft.merchantId,
            version: next,
            document: toDocument(numbered.record()),
          });
          return numbered;
        }),
      ),
    latestOf: (merchantId) => {
      const rows = deps.store.all(LATEST, { merchant: merchantId });
      const row = rows[0];
      return Promise.resolve(row === undefined ? undefined : versionOf(row));
    },
    versionsOf: (merchantId, query) => {
      const window = descending(query);
      const rows = deps.store.all(VERSIONS, {
        merchant: merchantId,
        below: window.below,
        limit: window.limit,
      });
      return Promise.resolve(
        pageTo(
          rows.map((row) => ({ key: Number(row["version"]), item: versionOf(row) })),
          window,
        ),
      );
    },
  };
}
