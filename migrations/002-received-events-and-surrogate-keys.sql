-- The register of what the SDK sends (feature 031, FR-001..FR-006), and the two architecture rules of
-- the owner (2026-09-27) applied to **every** table, including the seven feature 030 created:
--
--   1. every table has its own autoincrementing primary key; what used to be the business key
--      becomes a UNIQUE index, where there is one to keep;
--   2. every table has `created_at` and `updated_at`, equal when the row is created.
--
-- **Why the seven are rebuilt and not altered.** SQLite admits neither adding a PRIMARY KEY nor
-- adding a NOT NULL column with a non-constant default, so the procedure its own documentation
-- prescribes is the only one there is: create the new shape, copy, drop, rename. The runner applies
-- this file in a transaction, so it happens whole or not at all (feature 031, research R-03).
--
-- **What the timestamps of the rows that already exist mean.** Not when they were recorded — that
-- instant does not exist, was never stored, and inventing one would put a false date in a register
-- whose whole purpose is auditing. They carry **the instant of this migration**: "this row was here
-- when the schema changed", which is true. Rows written from here on carry their own.
--
-- **And they come from the store, as a DEFAULT, not from the injected clock.** That is the line the
-- two kinds of time fall on: an instant the *domain* means —`decidedAt`, `confirmedAt`, `exposedAt`,
-- the `received_at` of an event— comes from the `Clock` port and lives where the domain puts it,
-- because a test has to be able to decide it. `created_at` and `updated_at` say when the *row* was
-- written, which only the store knows. Making them defaults also means the owner's second rule holds
-- **by construction**: no gateway can forget them, and SQLite evaluates `'now'` once per statement,
-- so the two are equal on creation without anything having to keep them so.
--
-- The two statements that *update* a row —a return on an order (ADR-028) and a republished snapshot—
-- set `updated_at` themselves, because a DEFAULT does not fire on an UPDATE.
--
-- **What this saves.** The order of insertion used to be read from SQLite's implicit `rowid` (see
-- `001`), which PostgreSQL does not have. `id` does, so the three queries that named `rowid` now name
-- `id` and stop depending on the engine — one of the three things debt **D-21** left resting on it.
--
-- The copies say `ORDER BY rowid` on purpose: it is the last thing read from the implicit column, and
-- it is what makes the new `id` follow the order the rows were originally written in.

-- Decisions: found by identifier, listed by session.
CREATE TABLE decisions_migrated (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  document    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO decisions_migrated (merchant_id, decision_id, session_id, document, created_at, updated_at)
SELECT merchant_id, decision_id, session_id, document,
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM decisions ORDER BY rowid;

DROP TABLE decisions;
ALTER TABLE decisions_migrated RENAME TO decisions;
CREATE UNIQUE INDEX decisions_key ON decisions (merchant_id, decision_id);
CREATE INDEX decisions_by_session ON decisions (merchant_id, session_id);

-- Exposures: one per decision, and the UNIQUE index is what keeps confirming twice idempotent.
CREATE TABLE exposures_migrated (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  document    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO exposures_migrated (merchant_id, decision_id, document, created_at, updated_at)
SELECT merchant_id, decision_id, document,
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM exposures ORDER BY rowid;

DROP TABLE exposures;
ALTER TABLE exposures_migrated RENAME TO exposures;
CREATE UNIQUE INDEX exposures_key ON exposures (merchant_id, decision_id);

-- Orders: the one table of this schema a write updates, which is ADR-028's state machine.
CREATE TABLE orders_migrated (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  order_id    TEXT NOT NULL,
  document    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO orders_migrated (merchant_id, order_id, document, created_at, updated_at)
SELECT merchant_id, order_id, document,
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM orders ORDER BY rowid;

DROP TABLE orders;
ALTER TABLE orders_migrated RENAME TO orders;
CREATE UNIQUE INDEX orders_key ON orders (merchant_id, order_id);

-- Corroborations: one per merchant, order and session, the first winning.
CREATE TABLE corroborations_migrated (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  order_id    TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  document    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO corroborations_migrated (merchant_id, order_id, session_id, document, created_at, updated_at)
SELECT merchant_id, order_id, session_id, document,
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM corroborations ORDER BY rowid;

DROP TABLE corroborations;
ALTER TABLE corroborations_migrated RENAME TO corroborations;
CREATE UNIQUE INDEX corroborations_key ON corroborations (merchant_id, order_id, session_id);

-- Assignments: which arm a visitor fell into; the UNIQUE index is why the first arm wins.
CREATE TABLE assignments_migrated (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id   TEXT NOT NULL,
  experiment_id TEXT NOT NULL,
  visitor_id    TEXT NOT NULL,
  document      TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO assignments_migrated (merchant_id, experiment_id, visitor_id, document, created_at, updated_at)
SELECT merchant_id, experiment_id, visitor_id, document,
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM assignments ORDER BY rowid;

DROP TABLE assignments;
ALTER TABLE assignments_migrated RENAME TO assignments;
CREATE UNIQUE INDEX assignments_key ON assignments (merchant_id, experiment_id, visitor_id);

-- The current catalogue snapshot of each merchant: one row, replaced whole on every publication.
CREATE TABLE catalog_snapshots_migrated (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  document    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO catalog_snapshots_migrated (merchant_id, document, created_at, updated_at)
SELECT merchant_id, document,
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM catalog_snapshots ORDER BY rowid;

DROP TABLE catalog_snapshots;
ALTER TABLE catalog_snapshots_migrated RENAME TO catalog_snapshots;
CREATE UNIQUE INDEX catalog_snapshots_key ON catalog_snapshots (merchant_id);

-- The instants OPE received the last few snapshots. **This one keeps no UNIQUE index**, and that is
-- not an omission: two receipts of the same merchant at the same instant are two receipts, so there
-- is no business key to promote. The owner's rule admits it — a UNIQUE index goes in "where it is
-- necessary", and here the necessary thing is that the pair is not unique.
CREATE TABLE catalog_receipts_migrated (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  received_at TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO catalog_receipts_migrated (merchant_id, received_at, created_at, updated_at)
SELECT merchant_id, received_at,
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM catalog_receipts ORDER BY rowid;

DROP TABLE catalog_receipts;
ALTER TABLE catalog_receipts_migrated RENAME TO catalog_receipts;
CREATE INDEX catalog_receipts_by_merchant ON catalog_receipts (merchant_id);

-- What the SDK sent, one row per event **per arrival**: the same event arriving twice is two facts,
-- and keeping both is what makes the register forensic rather than a picture of what OPE accepted
-- (feature 031, Q1, decided by measuring three shapes against the real engine).
--
-- So there is **no unique key on the event**: `(merchant_id, batch_id, position)` identifies an
-- arrival, which is what a row is. `event_id` carries a **non-unique** index, and that is how every
-- arrival of one event is found — including the original of a duplicate, without the deduplication
-- window having to carry a reference it does not have (research R-04, R-08).
--
-- Columns are only what a query filters or groups by; the rest of the event travels in `document`,
-- as the domain has it. `received_at` is when OPE received it and `created_at` is when the queue
-- wrote it: **their difference is the lag of the queue** (FR-015), measurable without instrumenting
-- anything.
CREATE TABLE received_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  batch_id    TEXT NOT NULL,
  position    INTEGER NOT NULL,
  event_id    TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  type        TEXT NOT NULL,
  received_at TEXT NOT NULL,
  disposition TEXT NOT NULL,
  decision_id TEXT,
  document    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One row per arrival, which is also the idempotency of the write: the queue may hand the same
-- arrival over twice and the store decides, without a read first.
CREATE UNIQUE INDEX received_events_arrival ON received_events (merchant_id, batch_id, position);

-- The events of a decision, and the decision of an event (FR-003).
CREATE INDEX received_events_by_decision ON received_events (merchant_id, decision_id);

-- The events of a session in arrival order (FR-013): `id` in the index is what gives the order,
-- so no column has to carry a counter that could disagree with reality. This is what feature 032
-- reads to rebuild the signals a decision was taken with.
CREATE INDEX received_events_by_session ON received_events (merchant_id, session_id, id);

-- Every arrival of one event id (FR-005). Not unique, and that is the design.
CREATE INDEX received_events_by_event ON received_events (merchant_id, event_id);

-- The volume per merchant and type within a window (FR-012). **Covering on purpose**: measured, the
-- same query costs 507 ms with no useful index, 1 703 ms with `(merchant_id, type)` — worse than
-- none — and 107 ms with this one (research R-06). Its column order is the query's: equality,
-- then range, then what is grouped.
--
-- **The range is `received_at` and not `created_at`**, which the data model of this feature had the
-- other way round. FR-012 asks how many events *entered* and how they are spread over time, and that
-- is when OPE received them; `created_at` is when the queue got around to writing them, so a window
-- over it would smear the traffic of a merchant by the lag of a buffer of ours. `created_at` keeps its
-- own job, which is exactly to be subtracted from this one to measure that lag (FR-015).
CREATE INDEX received_events_volume ON received_events (merchant_id, received_at, type);

PRAGMA user_version = 2;
