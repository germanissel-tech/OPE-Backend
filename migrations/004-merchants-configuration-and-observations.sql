-- What an operator configures and what was observed of a merchant's traffic (feature 033). Seven
-- tables for six stores: the origins of a merchant get one of their own, for the reason below.
--
-- **This is the first migration of the series that only creates.** The `002` and the `003` rebuilt
-- tables — create, copy, drop, rename — because SQLite admits neither adding a PRIMARY KEY nor adding a
-- NOT NULL column with a non-constant default. Here there is nothing to carry over: none of these six
-- stores was ever persisted, so what it has to get right is the opposite — **not touching anything that
-- is already here**.
--
-- The convention is the one `migrations/README.md` fixes: its own autoincrementing key, `created_at` and
-- `updated_at` as defaults of the store, the merchant, **the key the port searches by**, and everything
-- else in `document` as the domain has it.

-- The merchant. `status` is a column because `list` paginates merchants and the state is the first thing
-- a panel filters by; the origins, the credential fingerprints with the expiry of a rotated one, and the
-- instant it was created travel in the document, which is `merchant.record()`.
--
-- **And there is deliberately no index by credential fingerprint**, which is what the authentication edge
-- would seem to need. That search does not reach the store: the gateway keeps an in-memory index of the
-- merchants and answers from it, because going to the store there is one read per request today and one
-- network round trip the day the store is remote (D-21, research R-02). An index nobody uses is weight on
-- every write and a false promise about where this table is searched.
CREATE TABLE merchants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  status      TEXT NOT NULL,
  document    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX merchants_key ON merchants (merchant_id);

-- The origins, and **the only thing this schema takes out of a document**.
--
-- An origin belongs to **one merchant, deactivated ones included** (invariant `origin-already-registered`
-- of the contract), and that is a uniqueness **between** merchants. Inside a document no index can
-- enforce it, and enforcing it by reading before writing is exactly the race between the check and the
-- write that `01 §6` forbids. With the index, **the store decides**.
--
-- They are also in the merchant's document, because the document is `record()` and `record()` carries
-- them. That is not two truths: this table exists so that an index can enforce the uniqueness, and it is
-- written in the same transaction as the merchant.
CREATE TABLE merchant_origins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  origin      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX merchant_origins_origin ON merchant_origins (origin);
CREATE INDEX merchant_origins_by_merchant ON merchant_origins (merchant_id, id);

-- The configuration a merchant declared, one row per published version. **The effective one is the one
-- with the highest version** — there is no "current" flag, which would be a second place saying the same
-- thing and able to disagree with the first.
CREATE TABLE merchant_configurations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  version     INTEGER NOT NULL,
  document    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX merchant_configurations_key ON merchant_configurations (merchant_id, version);

-- The experiments. The lifecycle, the split, the seed, the target sample, the cuts and the window
-- restarts travel in the document: nobody searches by them, and `listOf` brings the merchant's and lets
-- the caller filter.
--
-- Why they are here at all: the **assignments** have been durable since feature 030 and the definition of
-- the experiment was not, so a restart left assignments naming an experiment that no longer existed. It
-- did not show on the seeded merchants because the file brings the same identifiers back.
CREATE TABLE experiments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id   TEXT NOT NULL,
  experiment_id TEXT NOT NULL,
  document      TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX experiments_key ON experiments (merchant_id, experiment_id);
CREATE INDEX experiments_by_merchant ON experiments (merchant_id, id);

-- What an operator did. Append-only and **with no business key and no unique index**: two identical
-- actions by the same operator at the same instant are two actions, the same decision `received_events`
-- took for two arrivals of one event. It is **not pruned** (FR-009): the retention is permanent and
-- declared, and its volume is operator actions rather than traffic.
--
-- **`merchant_id` is the first nullable column of this schema**, and it is nullable because the absence
-- **means** something: an action of the platform — importing the seed, listing merchants — and not of a
-- merchant. `listOf` filters by equality and therefore never brings them.
CREATE TABLE admin_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT,
  document    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- **One index and not two**: the global read — newest first, resuming below a row — goes through the
-- table's own key, because `id INTEGER PRIMARY KEY` **is** the rowid and SQLite searches it directly
-- (`SEARCH admin_entries USING INTEGER PRIMARY KEY (rowid<?)`, verified in `tests/durability/`). An
-- index on `id` would be a second copy of the table's own order, paid on every append and used by
-- nothing. The one by merchant earns its place: without it, a merchant's log would scan.
CREATE INDEX admin_entries_by_merchant ON admin_entries (merchant_id, id);

-- The anchors the SDK could not resolve, per surface. The key is the one the port upserts on, and
-- **`count` is a column and not part of the document** — the only counter in this schema that is — because
-- the store has to increment it (`ON CONFLICT … DO UPDATE SET count = count + 1`): doing it by reading
-- and then writing is another race.
--
-- **The configuration version is part of the key, and `0` means the SDK did not say which one it had.**
-- Two things forced it. The port keys on anchor, surface **and** version — a report that arrives without
-- a version is its own row, which the SDK surface has asserted since feature 027 — so leaving the version
-- out of the index would merge two counts that are deliberately separate. And it cannot be a nullable
-- column either: SQLite treats NULLs as distinct in a unique index, so every versionless report would
-- insert a row of its own instead of incrementing the one that is there. A published version is 1 or
-- more, because the store numbers them from one, so `0` is free to mean "not said" and the document keeps
-- the field absent.
--
-- How many are kept per merchant is not in the schema: it arrives with every write, because it is policy
-- (constitution XI), like the cap on catalogue receipts.
CREATE TABLE anchor_diagnostics (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id           TEXT NOT NULL,
  anchor                TEXT NOT NULL,
  surface               TEXT NOT NULL,
  configuration_version INTEGER NOT NULL,
  count                 INTEGER NOT NULL,
  document              TEXT NOT NULL,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX anchor_diagnostics_key
  ON anchor_diagnostics (merchant_id, anchor, surface, configuration_version);

-- The attribute labels that arrived in a catalogue and that the merchant's map does not translate. The
-- port **replaces** the merchant's whole set, so there is no key to conflict on: the gateway deletes the
-- merchant's rows and writes the new ones inside one transaction, because a half-done replacement leaves
-- a set that never existed.
CREATE TABLE unmapped_values (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  document    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX unmapped_values_by_merchant ON unmapped_values (merchant_id, id);

PRAGMA user_version = 4;
