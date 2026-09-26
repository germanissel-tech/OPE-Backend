-- The first shape of the durable store (feature 030, FR-007). One table per entity of the ledger,
-- plus the catalogue snapshot and its receipts.
--
-- In every table there are columns for two things only: the merchant, which every read takes and
-- which is what isolation is made of (constitution V), and the key the port searches by. Everything
-- else travels in `document`, as the domain has it. The ledger is immutable and append-only, so
-- there are no partial updates to justify taking each entity apart into columns — and taking it
-- apart would mean keeping two shapes of the same domain in step, which is the duplication ADR-024
-- avoids in the code.
--
-- The exception is `orders`, which a return does update: that is ADR-028's state machine, not an
-- edit of what was recorded.
--
-- Order of insertion is read from SQLite's `rowid`, which is monotonic: `bySession` answers "in the
-- order they were recorded" and no column has to carry a counter that could disagree with reality.

PRAGMA user_version = 1;

-- Decisions: found by identifier, and listed by session so the outcomes module can correlate an
-- order with what the merchant's ledger knows of that session (ADR-028).
CREATE TABLE decisions (
  merchant_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  document    TEXT NOT NULL,
  PRIMARY KEY (merchant_id, decision_id)
);

CREATE INDEX decisions_by_session ON decisions (merchant_id, session_id);

-- Exposures: one per decision. The primary key is what makes confirming twice idempotent, and it
-- now holds **across a restart**, which is what turns idempotency into a guarantee instead of a
-- property of a process that is still up (FR-005).
CREATE TABLE exposures (
  merchant_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  document    TEXT NOT NULL,
  PRIMARY KEY (merchant_id, decision_id)
);

-- Orders: found by identifier. A return updates the document, which is the RETURNED state of
-- ADR-028 and the only write of this schema that is not an append.
CREATE TABLE orders (
  merchant_id TEXT NOT NULL,
  order_id    TEXT NOT NULL,
  document    TEXT NOT NULL,
  PRIMARY KEY (merchant_id, order_id)
);

-- Corroborations: one per merchant, order and session, the first winning (ADR-028). The session is
-- a column because it is part of that key, not because anything reads by it.
CREATE TABLE corroborations (
  merchant_id TEXT NOT NULL,
  order_id    TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  document    TEXT NOT NULL,
  PRIMARY KEY (merchant_id, order_id, session_id)
);

-- Assignments: which arm a visitor fell into. Losing these does not only erase information, it
-- changes behaviour — the assignment is stable per visitor by design (ADR-022), so a visitor who
-- came back after a restart used to be assigned again, possibly to the other arm.
CREATE TABLE assignments (
  merchant_id   TEXT NOT NULL,
  experiment_id TEXT NOT NULL,
  visitor_id    TEXT NOT NULL,
  document      TEXT NOT NULL,
  PRIMARY KEY (merchant_id, experiment_id, visitor_id)
);

-- The current catalogue snapshot of each merchant: one row, replaced whole on every publication.
CREATE TABLE catalog_snapshots (
  merchant_id TEXT NOT NULL PRIMARY KEY,
  document    TEXT NOT NULL
);

-- The instants OPE received the last few snapshots, which the observed synchronisation level is
-- derived from (ADR-025). How many are kept is the merchant's policy and arrives with each write,
-- so it is not a column and not a constant here.
CREATE TABLE catalog_receipts (
  merchant_id TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE INDEX catalog_receipts_by_merchant ON catalog_receipts (merchant_id);
