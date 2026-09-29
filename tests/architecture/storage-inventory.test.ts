// SC-011 of feature 033: **"everything that was configured or observed survives a restart" is a gate and
// not a sentence.**
//
// The claim is only worth what the list behind it is worth, and the list is what went wrong while the
// spec of this feature was being written: the first version named four stores, and auditing the ports one
// by one found three more — among them the experiments, whose loss left durable assignments pointing at a
// definition that no longer existed. Nobody had noticed because nothing forced the list to be complete.
//
// So this is the two-way check ADR-032 uses for the READMEs, applied to what keeps state: **a store with
// no classification fails, and a classification for a store that does not exist fails too.** What it does
// not do is decide anything for you — it makes the decision impossible to skip, which is the part that
// was missing.
//
// **What counts as a store, mechanically**: a gateway whose file name declares a technology
// (`memory-…`, `sqlite-…`, `recovering-…`). That is the repository's own convention for "this keeps
// something", and the rest of `gateways/` translates without remembering — a minter, a fingerprinter, a
// view over the configuration. A new store cannot avoid the convention without also leaving the
// composition unable to choose it.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RING = path.join("src", "interface-adapters");
const COMPOSITION = path.join("src", "composition", "modules");

/** The four columns of the inventory in the spec, and there is no fifth. */
type Column =
  /** Durable since features 030 and 031. */
  | "already-durable"
  /** Made durable by feature 033. */
  | "this-feature"
  /** Not durable on purpose: rebuilt from what is durable, or lost with a declared consequence. */
  | "recoverable"
  /** Not a store of the platform: it comes from the files of the deployment at every boot. */
  | "deployment-configuration";

interface Store {
  /** What it keeps, in the words of the inventory. */
  readonly keeps: string;
  readonly column: Column;
  /** The gateway of the in-memory deployment, which every store has. */
  readonly memory: string;
  /**
   * What makes it survive a restart: the durable gateway, or the one that rebuilds it. Absent only for
   * a column that explains why nothing survives — and the test checks that, so it cannot be an omission.
   */
  readonly durable?: string;
}

/**
 * The inventory. It is the table of the spec, in the form a test can read: one row per store, and the
 * column that says what a restart does to it.
 *
 * It lives here and not in a JSON of its own because it is the subject of this test rather than a
 * configuration anything else reads — and because a reviewer of a new store finds it in the file that
 * refused their commit.
 */
const INVENTORY: readonly Store[] = [
  // Already durable: features 030 and 031.
  {
    keeps: "decisions",
    column: "already-durable",
    memory: "ledger/gateways/memory-decision-ledger.ts",
    durable: "ledger/gateways/sqlite-decision-ledger.ts",
  },
  {
    keeps: "exposures",
    column: "already-durable",
    memory: "ledger/gateways/memory-exposure-ledger.ts",
    durable: "ledger/gateways/sqlite-exposure-ledger.ts",
  },
  {
    keeps: "orders",
    column: "already-durable",
    memory: "outcomes/gateways/memory-order-ledger.ts",
    durable: "outcomes/gateways/sqlite-order-ledger.ts",
  },
  {
    keeps: "corroborations",
    column: "already-durable",
    memory: "outcomes/gateways/memory-corroboration-ledger.ts",
    durable: "outcomes/gateways/sqlite-corroboration-ledger.ts",
  },
  {
    keeps: "assignments of a visitor to an arm",
    column: "already-durable",
    memory: "experiment/gateways/memory-assignment-ledger.ts",
    durable: "experiment/gateways/sqlite-assignment-ledger.ts",
  },
  {
    keeps: "the catalogue and its receipts",
    column: "already-durable",
    memory: "catalog/gateways/memory-catalog-store.ts",
    durable: "catalog/gateways/sqlite-catalog-store.ts",
  },
  {
    keeps: "the register of what the SDK sent",
    column: "already-durable",
    memory: "ingestion/gateways/memory-event-log.ts",
    durable: "ingestion/gateways/sqlite-event-log.ts",
  },

  // Feature 033: what an operator configures and what was observed of a merchant's traffic.
  {
    keeps: "merchants, their origins and their credential fingerprints",
    column: "this-feature",
    memory: "merchant/gateways/memory-merchant-store.ts",
    durable: "merchant/gateways/sqlite-merchant-store.ts",
  },
  {
    keeps: "the published configuration and all its versions",
    column: "this-feature",
    memory: "configuration/gateways/memory-configuration-store.ts",
    durable: "configuration/gateways/sqlite-configuration-store.ts",
  },
  {
    keeps: "experiments and their lifecycle",
    column: "this-feature",
    memory: "experiment/gateways/memory-experiment-store.ts",
    durable: "experiment/gateways/sqlite-experiment-store.ts",
  },
  {
    keeps: "the record of what each operator did",
    column: "this-feature",
    memory: "admin/gateways/memory-admin-log.ts",
    durable: "admin/gateways/sqlite-admin-log.ts",
  },
  {
    keeps: "the anchors the SDK could not resolve",
    column: "this-feature",
    memory: "admin/gateways/memory-anchor-diagnostics-store.ts",
    durable: "admin/gateways/sqlite-anchor-diagnostics-store.ts",
  },
  {
    keeps: "the attribute labels OPE has no word for",
    column: "this-feature",
    memory: "admin/gateways/memory-unmapped-value-log.ts",
    durable: "admin/gateways/sqlite-unmapped-value-log.ts",
  },

  // Recoverable on purpose: rebuilt from what is durable, each with the read that rebuilds it.
  {
    keeps: "the hot state of a session",
    column: "recoverable",
    memory: "decision/gateways/memory-session-state-store.ts",
    // Feature 032: rebuilt from the decisions ledger and the register when the memory does not have it.
    durable: "decision/gateways/durable-past-activity.ts",
  },
  {
    keeps: "the hot state of a visitor",
    column: "recoverable",
    memory: "decision/gateways/memory-visitor-state-store.ts",
    durable: "decision/gateways/durable-past-activity.ts",
  },
  {
    keeps: "the deduplication window of event ids",
    column: "recoverable",
    memory: "ingestion/gateways/memory-event-dedup.ts",
    // Feature 033: rebuilt from the register the first time each merchant appears after a boot.
    durable: "ingestion/gateways/recovering-event-dedup.ts",
  },

  // Not a store of the platform: it is read from the files of the release at every boot, so a restart
  // cannot lose it — and if the files changed, the new texts are what the boot brings.
  {
    keeps: "the curated texts of the release",
    column: "deployment-configuration",
    memory: "messages/gateways/memory-message-corpus.ts",
  },
];

/** A gateway whose name declares a technology: the repository's own way of saying "this keeps something". */
const KEEPS_SOMETHING = /^(memory|sqlite|recovering)-/;

/** Every store the ring has, as paths relative to it. */
function gatewaysThatKeep(): readonly string[] {
  const found: string[] = [];
  for (const module of readdirSync(RING, { withFileTypes: true })) {
    if (!module.isDirectory()) continue;
    const gateways = path.join(RING, module.name, "gateways");
    let entries: readonly string[];
    try {
      entries = readdirSync(gateways);
    } catch {
      continue;
    }
    for (const file of entries) {
      if (KEEPS_SOMETHING.test(file)) found.push(`${module.name}/gateways/${file}`);
    }
  }
  return found.sort();
}

/** What the inventory names, memory and durable halves together. */
const named = (): readonly string[] =>
  INVENTORY.flatMap((store) => [store.memory, ...(store.durable === undefined ? [] : [store.durable])]);

describe("the inventory of what survives a restart (SC-011)", () => {
  it("classifies every store the ring has", () => {
    // The half that catches the next feature: a store nobody classified is a store nobody decided about.
    const unclassified = gatewaysThatKeep().filter((file) => !named().includes(file));
    expect(unclassified).toEqual([]);
  });

  it("names no file that does not exist", () => {
    // The other direction, which is what keeps the inventory from ageing into fiction: a row that
    // outlived the gateway it described would make the list look complete while naming nothing.
    //
    // It asks the disk rather than the list above, because what makes a store survive is not always a
    // store: the hot state of a session is rebuilt by `durable-past-activity`, which keeps nothing and is
    // exactly the point of the `recoverable` column.
    const absent = named().filter((file) => !existsSync(path.join(RING, file)));
    expect(absent).toEqual([]);
  });

  it("gives every store in the first three columns something that survives the restart", () => {
    // `deployment-configuration` is the only column allowed to have nothing, and the reason is in its
    // own row: it is not kept by the platform at all, it is read from the files at every boot.
    const withoutSurvival = INVENTORY.filter(
      (store) => store.column !== "deployment-configuration" && store.durable === undefined,
    );
    expect(withoutSurvival.map((store) => store.keeps)).toEqual([]);
  });

  it("has every durable gateway wired by some deployment", () => {
    // A gateway nobody binds is an inventory that lies in the way hardest to see: the file is there, the
    // test of the file passes, and no deployment writes anything through it.
    const wiring = readdirSync(COMPOSITION)
      .map((file) => readFileSync(path.join(COMPOSITION, file), "utf8"))
      .join("\n");
    const missing = INVENTORY.flatMap((store) =>
      store.durable === undefined || wiring.includes(factoryOf(store.durable)) ? [] : [store.durable],
    );
    expect(missing).toEqual([]);
  });

  it("does not let a column be invented", () => {
    // The four are the spec's, and a fifth would be a decision taken in a test file.
    const columns = new Set(INVENTORY.map((store) => store.column));
    expect([...columns].sort()).toEqual([
      "already-durable",
      "deployment-configuration",
      "recoverable",
      "this-feature",
    ]);
  });
});

/** The name of the factory a gateway file exports: `sqlite-admin-log.ts` builds `sqliteAdminLog`. */
function factoryOf(file: string): string {
  const base = path.basename(file, ".ts");
  return base.replace(/-([a-z])/g, (_all, letter: string) => letter.toUpperCase());
}
