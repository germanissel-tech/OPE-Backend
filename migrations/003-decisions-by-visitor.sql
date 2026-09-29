-- The read by visitor (feature 032, FR-007). The fatigue limit counts the interventions of a
-- **visitor** across their sessions, and the ledger had no way to answer that: it indexes by decision
-- and by session, and the visitor lives inside `document`, where no index reaches it. Until now the
-- count came only from hot memory, so a restart handed every visitor their whole quota back.
--
-- **Why the table is rebuilt instead of altered.** `ALTER TABLE ADD COLUMN` would do the job and is
-- deliberately not used: SQLite admits no `NOT NULL` column without a constant default, and once the
-- column is filled there is no way back to `NOT NULL` without rebuilding anyway. It would stay
-- **nullable for ever**.
--
-- And nullable here has a concrete cost. The day a gateway forgets the visitor it would write `NULL`
-- in silence and **the read by visitor would stop finding those decisions** — a cap that stops
-- applying without anything failing. `NOT NULL` turns that into an error at the moment of writing,
-- which is the only moment it is cheap.
--
-- **The timestamps are copied, not regenerated**: this migration is not when the row appeared, and
-- inventing a date in a ledger whose purpose is auditing is the one thing it must not do. That is the
-- difference from `002`, which had no earlier value to carry.
--
-- The runner applies this file in a transaction, so create, copy, drop and rename happen whole or not
-- at all.

CREATE TABLE decisions_migrated (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  visitor_id  TEXT NOT NULL,
  document    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- `ORDER BY id` keeps the order the rows were written in, which is what `bySession` promises and what
-- the new `id` has to follow. `002` said `ORDER BY rowid` because that was the last migration to read
-- the implicit column; from here the explicit one is there and is what every query names.
INSERT INTO decisions_migrated (merchant_id, decision_id, session_id, visitor_id, document, created_at, updated_at)
SELECT merchant_id, decision_id, session_id,
       json_extract(document, '$.visitorId'),
       document, created_at, updated_at
FROM decisions ORDER BY id;

DROP TABLE decisions;
ALTER TABLE decisions_migrated RENAME TO decisions;
CREATE UNIQUE INDEX decisions_key        ON decisions (merchant_id, decision_id);
CREATE INDEX        decisions_by_session ON decisions (merchant_id, session_id);
-- The index the fatigue read uses, and it carries `created_at` so the 24-hour window is a range the
-- planner walks instead of a filter over every decision the visitor ever produced.
--
-- **It is the row's instant and not the decision's, and that is sound in one direction only.** The
-- instant the domain means (`decidedAt`) lives inside the document, where no index reaches it. But a
-- row is always written *after* the decision it records, so `created_at >= since` can only let through
-- more than the window, never less: a decision whose `decidedAt` is inside it cannot have a
-- `created_at` outside. The exact cut stays where it already was, in `VisitorState.countSince`, so
-- this bound is an optimisation and never the rule.
CREATE INDEX        decisions_by_visitor ON decisions (merchant_id, visitor_id, created_at);

PRAGMA user_version = 3;
