-- The two levels of the release, as published versions (feature 036; constitution XI; ADR-031 as amended).
--
-- Until now they were files of the release read at every boot, so changing a platform rule or a treatment
-- default meant a deploy — which contaminates any measurement in course exactly the same way, without a
-- version, without an entry in the administration log and without restarting the window it invalidated.
-- Now they are published by API as numbered, immutable versions, and the files are the **seed**: applied
-- once, over an empty store.
--
-- One table for the two levels, with `level` as part of the key: they carry different vocabularies but have
-- the same life, and two tables would be the same shape twice. `MAX(version) + 1` **per level** inside the
-- transaction that writes, so two operators publishing at once never share a number.
--
-- What travels in the document: the content as it was published, the operator, the instant and the reason
-- when the version is corrective. Nobody searches by any of them — a level has one version in force and a
-- history read newest first — so they are not columns.
CREATE TABLE configuration_levels (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  level      TEXT NOT NULL,
  version    INTEGER NOT NULL,
  document   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX configuration_levels_key ON configuration_levels (level, version);

PRAGMA user_version = 5;
