-- The tables of the platform port (feature 044; ADR-047). The three at once: a migration is one version, and
-- the three belong to one decision.
--
-- `stock_and_price` is the refresh of a variant, a layer over the snapshot and not a new snapshot: the truth of
-- a variant is the newest of the two (ADR-047). One row per variant of a merchant, replaced only by a newer
-- instant. `observed_at` is a column besides the document because the replacement of a snapshot deletes the
-- refreshes it supersedes by comparing it, and a comparison inside a document is not one an index serves.
CREATE TABLE stock_and_price (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  variant_id  TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  document    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX stock_and_price_key ON stock_and_price (merchant_id, variant_id);

-- The state of each flow the scheduler reads: the cursor, the last run and its outcome. One row per flow of a
-- merchant; what it holds is the adapter's, so it is a document.
CREATE TABLE platform_sync (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  flow        TEXT NOT NULL,
  document    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX platform_sync_key ON platform_sync (merchant_id, flow);

-- The notices waiting to be read (`subscribe`): one per reference of a flow while it is pending, so a repeated
-- notice adds nothing. `next_at` is a column because the processor asks for the ones that are due.
CREATE TABLE platform_notices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  flow        TEXT NOT NULL,
  reference   TEXT NOT NULL,
  next_at     TEXT NOT NULL,
  document    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX platform_notices_key ON platform_notices (merchant_id, flow, reference);
CREATE INDEX platform_notices_due ON platform_notices (next_at);

PRAGMA user_version = 8;
