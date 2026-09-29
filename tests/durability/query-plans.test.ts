// The query plans of what feature 033 added, **over tables with rows**.
//
// SQLite plans an empty table differently, so the same assertion against a fresh store passes without
// saying anything — feature 032 learned that the hard way. Every table here is filled first.
//
// **Why the plan is verified at all**: in feature 031 a wrong index was more than three times worse than
// none (507 ms with none, 1 703 ms with the wrong one, 107 ms with the covering one), and none of that
// shows up in a test that only checks the answer. A query that stopped using its index still answers.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { asBatchId, asEventId } from "../../src/domain/ingestion/index.js";
import { asOperatorId } from "../../src/domain/operator/index.js";
import { asMerchantId, type Anchor } from "../../src/domain/shared-kernel/index.js";
import {
  sqliteAdminLog,
  sqliteAnchorDiagnosticsStore,
  sqliteUnmappedValueLog,
} from "../../src/interface-adapters/admin/index.js";
import { sqliteConfigurationStore } from "../../src/interface-adapters/configuration/index.js";
import {
  memoryExperimentStore,
  sqliteExperimentStore,
} from "../../src/interface-adapters/experiment/index.js";
import { sqliteEventLog } from "../../src/interface-adapters/ingestion/index.js";
import { memoryMerchantStore, sqliteMerchantStore } from "../../src/interface-adapters/merchant/index.js";
import { testExperiment } from "../helpers/experiments.js";
import { testMerchant } from "../helpers/merchants.js";
import { decided } from "../unit/interface-adapters/ingestion/event-log.contract.js";
import { restartableStore, type Restartable } from "./store-fixture.js";

const NOW = new Date("2026-09-29T10:00:00.000Z");
const A = asMerchantId("m_uno");
const B = asMerchantId("m_dos");
const ROWS = 200;

let fixture: Restartable;

beforeEach(async () => {
  fixture = restartableStore();
  const { store, logger } = fixture;
  // Two merchants and their origins, so a lookup by origin has something to discriminate.
  const merchants = sqliteMerchantStore({ store, logger, index: memoryMerchantStore() });
  await merchants.create(testMerchant({ merchantId: "m_uno", origins: ["https://uno.example"] }));
  await merchants.create(
    testMerchant({ merchantId: "m_dos", ingestKeys: ["key-2"], origins: ["https://dos.example"] }),
  );

  const configurations = sqliteConfigurationStore({ store, logger });
  const experiments = sqliteExperimentStore({ store, logger, index: memoryExperimentStore() });
  const entries = sqliteAdminLog({ store, logger });
  const diagnostics = sqliteAnchorDiagnosticsStore({ store, logger, kept: ROWS });
  const anchors: readonly Anchor[] = ["price", "cta", "variant_selector", "policies"];

  for (let n = 0; n < ROWS; n += 1) {
    const merchantId = n % 2 === 0 ? A : B;
    await configurations.publish({
      merchantId,
      declared: { holdoutShare: 0.1 },
      corrective: false,
      publishedAt: NOW,
      operatorId: asOperatorId("op_ana"),
    });
    await entries.record({
      at: NOW,
      operatorId: asOperatorId("op_ana"),
      operation: "publishMerchantConfiguration",
      outcome: "accepted",
      merchantId,
    });
    // A platform action every so often: a row with no merchant, which is what `listOf` must not bring.
    if (n % 10 === 0) {
      await entries.record({
        at: NOW,
        operatorId: asOperatorId("system"),
        operation: "importMerchants",
        outcome: "accepted",
      });
    }
    await diagnostics.upsert({
      merchantId,
      anchor: anchors[n % anchors.length] ?? "price",
      pageType: `surface-${String(n % 20)}`,
      lastSeenAt: NOW,
      configurationVersion: n % 3,
    });
  }
  await sqliteUnmappedValueLog({ store, logger, kept: ROWS }).replace(
    A,
    Array.from({ length: 50 }, (_, n) => ({ label: `label-${String(n)}`, products: n })),
    NOW,
  );
  // The experiments come last because each `open` judges the merchant's set, and one open at a time is
  // all the invariant allows: what this needs is rows, not a hundred of them.
  await experiments.open(testExperiment({ experimentId: "exp_uno", merchantId: "m_uno", status: "closed" }));
  await experiments.open(testExperiment({ experimentId: "exp_dos", merchantId: "m_dos", status: "closed" }));

  // The register, whose rows are what the rebuild of the deduplication window reads.
  const register = sqliteEventLog({ store, logger });
  for (let n = 0; n < ROWS; n += 1) {
    register.record([
      decided({
        merchantId: n % 2 === 0 ? A : B,
        batchId: asBatchId(`bat_${String(n)}`),
        event: { ...decided().event, eventId: asEventId(`evt_${String(n).padStart(8, "0")}`) },
        receivedAt: new Date(NOW.getTime() + n),
      }),
    ]);
  }
});

afterEach(() => {
  fixture.dispose();
});

/** The plan of a statement, as one line: what SQLite says it will do. */
const planOf = (sql: string, params: Record<string, string | number> = {}): string =>
  fixture.store
    .all(`EXPLAIN QUERY PLAN ${sql}`, params)
    .map((row) => String(row["detail"]))
    .join(" | ");

describe("the reads feature 033 added use their indexes", () => {
  it.each([
    [
      "the owner of an origin, which is the uniqueness between merchants",
      "merchant_origins_origin",
      "merchant_origins",
      `SELECT merchant_id FROM merchant_origins WHERE origin = 'https://dos.example'`,
    ],
    [
      "the version in force of a merchant",
      "merchant_configurations_key",
      "merchant_configurations",
      `SELECT document FROM merchant_configurations WHERE merchant_id = 'm_uno' ORDER BY version DESC LIMIT 1`,
    ],
    [
      "the history of a merchant, resuming below a version",
      "merchant_configurations_key",
      "merchant_configurations",
      `SELECT version, document FROM merchant_configurations
       WHERE merchant_id = 'm_uno' AND version < 50 ORDER BY version DESC LIMIT 3`,
    ],
    [
      "the experiments of a merchant, which is the set an open judges",
      "experiments_by_merchant",
      "experiments",
      `SELECT document FROM experiments WHERE merchant_id = 'm_uno' ORDER BY id`,
    ],
    [
      "the admin log of a merchant",
      "admin_entries_by_merchant",
      "admin_entries",
      `SELECT id, document FROM admin_entries WHERE merchant_id = 'm_uno' AND id < 500 ORDER BY id DESC LIMIT 3`,
    ],
    [
      "the diagnostics of a merchant",
      "anchor_diagnostics_key",
      "anchor_diagnostics",
      `SELECT count, document FROM anchor_diagnostics WHERE merchant_id = 'm_uno' ORDER BY updated_at DESC, id DESC`,
    ],
    [
      "the unmapped values of a merchant",
      "unmapped_values_by_merchant",
      "unmapped_values",
      `SELECT document FROM unmapped_values WHERE merchant_id = 'm_uno' ORDER BY id`,
    ],
    [
      "the ids of a merchant since an instant, which rebuilds the deduplication window",
      "received_events_volume",
      "received_events",
      `SELECT event_id FROM received_events WHERE merchant_id = 'm_uno' AND received_at >= '2026-01-01T00:00:00.000Z'
       ORDER BY received_at DESC, id DESC LIMIT 100`,
    ],
  ])("searches %s through %s", (_what, index, table, sql) => {
    const plan = planOf(sql);
    expect(plan).toContain(index);
    // A scan of the table is the failure this test exists to catch: the query still answers, and not in
    // the time anybody measured.
    expect(plan).not.toContain(`SCAN ${table}`);
  });

  it("finds the row a diagnostic accumulates on by its whole key", () => {
    // The `upsert` decides on the key, so what has to be indexed is the key and not its prefix: with
    // only the merchant, every report of a busy merchant would visit every row it has.
    const plan = planOf(
      `SELECT id FROM anchor_diagnostics
       WHERE merchant_id = 'm_uno' AND anchor = 'price' AND surface = 'surface-0' AND configuration_version = 0`,
    );
    expect(plan).toContain("anchor_diagnostics_key");
    expect(plan).not.toContain("SCAN anchor_diagnostics");
  });

  it("reads the global admin log through the table's own key, which is why there is no index for it", () => {
    // **This is what took an index out of the migration.** `id INTEGER PRIMARY KEY` *is* the rowid, so
    // SQLite searches it directly; `CREATE INDEX … (id)` would have been a second copy of the order the
    // table already has, paid on every append and used by nothing. The assertion is here so that
    // somebody reading the plan later does not add it back.
    const plan = planOf(`SELECT id, document FROM admin_entries WHERE id < 5000 ORDER BY id DESC LIMIT 3`);
    expect(plan).toContain("USING INTEGER PRIMARY KEY");
    expect(plan).not.toContain("SCAN admin_entries");
  });

  it("sorts in memory only where the set is already capped, or already narrowed to a page", () => {
    // Two plans of this feature add a temporary b-tree, and both are bounded — which is the difference
    // between a sort that costs nothing and one that grows with the table.
    //
    // The diagnostics sort by "most recently reported", which no index gives, over a set the policy caps
    // per merchant (`anchorDiagnosticsKept`). The rebuild of the deduplication window gets its order from
    // the index and needs the b-tree only for the **last** term, `id`, among rows sharing an instant.
    expect(
      planOf(
        `SELECT count, document FROM anchor_diagnostics WHERE merchant_id = 'm_uno' ORDER BY updated_at DESC, id DESC`,
      ),
    ).toContain("USE TEMP B-TREE FOR ORDER BY");
    expect(
      planOf(
        `SELECT event_id FROM received_events WHERE merchant_id = 'm_uno' AND received_at >= '2026-01-01T00:00:00.000Z'
         ORDER BY received_at DESC, id DESC LIMIT 100`,
      ),
    ).toContain("USE TEMP B-TREE FOR LAST TERM OF ORDER BY");
  });

  it("reads the whole table of merchants once, and that is not a scan to fix", () => {
    // The one read of the feature that **is** a full pass, on purpose: it fills the in-memory index at
    // boot. Asserting it here is what keeps somebody from adding an index for it later — there is no
    // predicate to index, and it happens once per process.
    expect(planOf(`SELECT document FROM merchants ORDER BY id`)).toContain("merchants");
  });
});
