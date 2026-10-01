// The two lists the panel shows of what was observed of a merchant's traffic (feature 033, US3): the
// anchors the SDK could not resolve, and the labels a catalogue brought that OPE has no word for.
//
// **What only shows up here is that a report accumulates over what was already there.** An `upsert` and
// an `insert` are indistinguishable in a process that never restarted — both end with the right count
// in memory — and they part company on the second boot: the `insert` starts the count again, so the
// burst of an anchor that has been failing for a week reads as a handful of sightings and nobody looks
// into it.
//
// The other half is the cap. It is **policy and not schema** (constitution XI), so it arrives with every
// write, and what it has to bound is what the store holds and not what this process happened to see.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { asMerchantId, type Anchor } from "../../src/domain/shared-kernel/index.js";
import {
  sqliteAnchorDiagnosticsStore,
  sqliteUnmappedValueLog,
} from "../../src/interface-adapters/admin/index.js";
import { restartableStore, type Restartable } from "./store-fixture.js";
import type { AnchorDiagnosticsStore, UnmappedValueLog } from "../../src/application/admin/index.js";

const NOW = new Date("2026-09-29T10:00:00.000Z");
const later = (ms: number): Date => new Date(NOW.getTime() + ms);
const A = asMerchantId("m_uno");
const B = asMerchantId("m_dos");
const NOTHING_MAPPED: ReadonlySet<string> = new Set();

let fixture: Restartable;

beforeEach(() => {
  fixture = restartableStore();
});

afterEach(() => {
  fixture.dispose();
});

/** The stores over the current connection. After `restart()` these are new ones over the same file. */
const diagnostics = (kept = 10): AnchorDiagnosticsStore =>
  sqliteAnchorDiagnosticsStore({ store: fixture.store, logger: fixture.logger, kept: () => kept });
const unmapped = (kept = 10): UnmappedValueLog =>
  sqliteUnmappedValueLog({ store: fixture.store, logger: fixture.logger, kept: () => kept });

const unresolved = (anchor: Anchor, at: Date, version?: number) => ({
  merchantId: A,
  anchor,
  pageType: "product",
  lastSeenAt: at,
  ...(version === undefined ? {} : { configurationVersion: version }),
});

describe("the anchor diagnostics across a restart", () => {
  it("accumulates over the count the store already had, instead of starting it again", async () => {
    const before = diagnostics();
    await before.upsert(unresolved("price", NOW));
    await before.upsert(unresolved("price", later(1000)));

    fixture.restart();

    const after = diagnostics();
    await after.upsert(unresolved("price", later(2000)));

    const page = await after.listOf(A, { limit: 10 });
    expect(page.items.map((d) => [d.anchor, d.count])).toEqual([["price", 3]]);
    // And the instant is the last report's, which is what tells an operator whether it is still failing.
    expect(page.items[0]?.lastSeenAt).toEqual(later(2000));
  });

  it("keeps a report that named its configuration version apart from one that did not", async () => {
    // The key of the port, and the trap of the schema: a nullable column would make **every** report
    // without a version its own row, because a unique index of SQLite treats NULLs as distinct.
    const store = diagnostics();
    await store.upsert(unresolved("price", NOW));
    await store.upsert(unresolved("price", later(1000)));
    await store.upsert(unresolved("price", later(2000), 3));

    fixture.restart();

    const page = await diagnostics().listOf(A, { limit: 10 });
    expect(page.items.map((d) => [d.configurationVersion, d.count])).toEqual([
      [3, 1],
      [undefined, 2],
    ]);
  });

  it("applies the cap over what the store holds, and drops the least recently reported", async () => {
    // The cap is policy and arrives with the write, so what it has to bound is the table. A gateway that
    // counted only what this process wrote would keep growing a row per boot.
    const first = diagnostics(2);
    await first.upsert(unresolved("price", NOW));
    await first.upsert(unresolved("cta", later(1000)));

    fixture.restart();

    await diagnostics(2).upsert(unresolved("variant_selector", later(2000)));

    const page = await diagnostics(2).listOf(A, { limit: 10 });
    expect(page.items.map((d) => d.anchor)).toEqual(["variant_selector", "cta"]);
  });

  it("shows a merchant nothing of another one", async () => {
    const store = diagnostics();
    await store.upsert(unresolved("price", NOW));
    await store.upsert({ ...unresolved("cta", later(1000)), merchantId: B });

    fixture.restart();

    const after = diagnostics();
    expect((await after.listOf(A, { limit: 10 })).items.map((d) => d.anchor)).toEqual(["price"]);
    expect((await after.listOf(B, { limit: 10 })).items.map((d) => d.anchor)).toEqual(["cta"]);
  });

  it("degrades instead of throwing when the store cannot accept the report", async () => {
    const store = diagnostics();
    fixture.makeUnavailable();

    const refused = await store.upsert(unresolved("price", NOW));
    expect(refused.ok).toBe(false);
    expect(refused.ok ? undefined : refused.error.code).toBe("store-unavailable");
    expect(fixture.logged.some((entry) => entry.message.includes("store"))).toBe(true);
  });
});

describe("the unmapped attribute values across a restart", () => {
  it("keeps the first sighting of a label the next catalogue brings again", async () => {
    // What an operator reads here is "since when is my shop not speaking", so the instant that must
    // survive is the first one — and it is the one a replacement would overwrite.
    await unmapped().replace(A, [{ label: "rojo-furia", products: 4 }], NOW);

    fixture.restart();

    await unmapped().replace(A, [{ label: "rojo-furia", products: 9 }], later(60_000));

    const page = await unmapped().pendingOf(A, NOTHING_MAPPED, { limit: 10 });
    expect(page.items.map((v) => [v.label, v.products])).toEqual([["rojo-furia", 9]]);
    expect(page.items[0]?.firstSeenAt).toEqual(NOW);
    expect(page.items[0]?.lastSeenAt).toEqual(later(60_000));
  });

  it("replaces the whole set, so a label that stopped arriving stops being a gap", async () => {
    await unmapped().replace(
      A,
      [
        { label: "rojo-furia", products: 4 },
        { label: "talle-unico", products: 2 },
      ],
      NOW,
    );

    fixture.restart();

    await unmapped().replace(A, [{ label: "talle-unico", products: 2 }], later(1000));

    fixture.restart();

    const page = await unmapped().pendingOf(A, NOTHING_MAPPED, { limit: 10 });
    expect(page.items.map((v) => v.label)).toEqual(["talle-unico"]);
  });

  it("applies the cap by first sighting over what was kept, and not by the catalogue's order", async () => {
    // Two things at once, and the catalogue is deliberately in the **opposite** order to the sightings:
    // the cap keeps the newest by first sighting, so what a rebuild of this set has to remember is which
    // label OPE had already seen — not which one the shop happened to list last. With the order taken
    // from the catalogue the answer here would be the other label, and both readings drop exactly one.
    await unmapped(1).replace(A, [{ label: "de-siempre", products: 1 }], NOW);

    fixture.restart();

    await unmapped(1).replace(
      A,
      [
        { label: "recien-llegada", products: 1 },
        { label: "de-siempre", products: 1 },
      ],
      later(1000),
    );

    const page = await unmapped(1).pendingOf(A, NOTHING_MAPPED, { limit: 10 });
    expect(page.items.map((v) => v.label)).toEqual(["recien-llegada"]);
  });

  it("leaves out what the merchant maps today, and answers the rest newest first", async () => {
    await unmapped().replace(
      A,
      [
        { label: "primera", products: 4 },
        { label: "segunda", products: 2 },
        { label: "tercera", products: 1 },
      ],
      NOW,
    );

    fixture.restart();

    const page = await unmapped().pendingOf(A, new Set(["segunda"]), { limit: 10 });
    // Newest first, which for labels of one catalogue is the reverse of the order it listed them in:
    // what an operator reads at the top is the most recent thing OPE stopped understanding.
    expect(page.items.map((v) => v.label)).toEqual(["tercera", "primera"]);
  });

  it("shows a merchant nothing of another one", async () => {
    const log = unmapped();
    await log.replace(A, [{ label: "de-a", products: 1 }], NOW);
    await log.replace(B, [{ label: "de-b", products: 1 }], NOW);

    fixture.restart();

    const after = unmapped();
    expect((await after.pendingOf(A, NOTHING_MAPPED, { limit: 10 })).items.map((v) => v.label)) //
      .toEqual(["de-a"]);
    expect((await after.pendingOf(B, NOTHING_MAPPED, { limit: 10 })).items.map((v) => v.label)) //
      .toEqual(["de-b"]);
  });

  it("does not refuse a catalogue because this could not be written", async () => {
    // The port returns nothing: a catalogue is ingested whether or not this is written, which is the
    // one place of the feature where a failed write is **not** reported to the caller. It is logged.
    const log = unmapped();
    fixture.makeUnavailable();

    await expect(log.replace(A, [{ label: "rojo-furia", products: 4 }], NOW)).resolves.toBeUndefined();
    expect(fixture.logged.some((entry) => entry.message.includes("store"))).toBe(true);
  });
});
