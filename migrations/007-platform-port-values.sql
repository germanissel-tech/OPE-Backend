-- The values of the platform port reach the two levels already published (feature 044; ADR-047).
--
-- Level 2 gains what governs how OPE reads a merchant's platform —the source, the confirmed order states,
-- the pull cadence and the notice retry— and level 1 gains how often the scheduler looks at what is due. The
-- readers of each level require them, and a stored version that does not parse stops the boot: that is the
-- rule changing **with** its migration, which is what the reader of the stored levels asks for.
--
-- **What every version before this one gains is what was running**, not a value somebody chose then: the
-- generic source (everything arrived by `push`), no confirmed state (no order was read from a platform), and
-- cadences that nothing used, because no flow could be pulled. The values are the ones of the release
-- files, so a store that never published a level and one that did read the same.
--
-- Only the versions that lack them are touched: running this twice, or over a version published with the
-- values, changes nothing.
UPDATE configuration_levels
SET document = json_set(
  document,
  '$.content.platformSource', 'generic',
  '$.content.confirmedOrderStates', json('[]'),
  '$.content.syncCadence', json('{"catalogMs":86400000,"stockAndPriceMs":60000,"stockAndPriceBatchSize":200,"ordersMs":120000,"returnsMs":900000}'),
  '$.content.noticeRetry', json('{"afterMs":60000,"maxAttempts":10}')
)
WHERE level = 'defaults' AND json_extract(document, '$.content.syncCadence') IS NULL;

UPDATE configuration_levels
SET document = json_set(document, '$.content.platformSyncTickMs', 30000)
WHERE level = 'platform' AND json_extract(document, '$.content.platformSyncTickMs') IS NULL;

PRAGMA user_version = 7;
