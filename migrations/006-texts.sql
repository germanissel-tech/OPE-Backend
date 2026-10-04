-- The texts a person sees, as published versions in two layers (feature 038; constitution VIII and X).
--
-- Until now the curated texts were a file of the release read at every boot, so changing a word or adding
-- a language meant a deploy — which changes a treatment in course exactly the same way, without a version,
-- without an entry in the administration log and without restarting the window it invalidated. Now every
-- key is published by API as numbered, immutable versions, in the **base** layer and in each merchant's,
-- and the file is the seed: applied once, over an empty store.
--
-- One table for the two layers, with `layer` as part of the key: the base and a merchant's texts have the
-- same life and two tables would be the same shape twice. `MAX(version) + 1` **per layer and key** inside
-- the transaction that writes, so two operators publishing at once never share a number.
--
-- **Two sentinels and no NULL**, on purpose: a unique index of SQLite treats NULLs as distinct, so a base
-- text under `layer IS NULL` could be inserted twice with the same number, and a text of a family that
-- speaks of nothing of the product under `attribute_value IS NULL` likewise. The base is `'base'` — a name
-- no merchant identifier takes, because every merchant identifier is minted with its prefix — and the
-- absent value is `''`.
--
-- What travels in the document: the text as it was published (absent when the version removes a
-- merchant's text), the operator, the instant, whether it is corrective and its reason. Nobody searches by
-- any of them — a key has one version in force and a history read newest first — so they are not columns.
CREATE TABLE texts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  layer           TEXT NOT NULL,
  family          TEXT NOT NULL,
  attribute_value TEXT NOT NULL,
  locale          TEXT NOT NULL,
  version         INTEGER NOT NULL,
  document        TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- The one index: the number of the next version, the history of a key newest first, and the load of what
-- is in force at boot all walk it; the ledger does not search texts by anything else.
CREATE UNIQUE INDEX texts_key ON texts (layer, family, attribute_value, locale, version);

PRAGMA user_version = 6;
