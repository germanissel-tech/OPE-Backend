// The admin log across a restart (feature 033, US2). It is the answer to "who changed this", and a log
// that is emptied by a deploy answers it only for the deploys nobody asks about.
//
// **The isolation here is a different one from the rest of the suite.** Everywhere else, a merchant must
// not see another merchant's rows. Here there is a third kind: the actions of the **platform** — the seed
// import, listing every merchant — which belong to no merchant. `listOf` filters by equality, so they
// never appear in a merchant's log, and that has to be true after a restart too.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { asOperatorId } from "../../src/domain/operator/index.js";
import { asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { sqliteAdminLog } from "../../src/interface-adapters/admin/index.js";
import { restartableStore, type Restartable } from "./store-fixture.js";
import type { AdminLog } from "../../src/application/admin/index.js";
import type { AdminEntry } from "../../src/domain/admin/index.js";

const NOW = new Date("2026-09-29T10:00:00.000Z");
const later = (ms: number): Date => new Date(NOW.getTime() + ms);

let fixture: Restartable;

beforeEach(() => {
  fixture = restartableStore();
});

afterEach(() => {
  fixture.dispose();
});

const log = (): AdminLog => sqliteAdminLog({ store: fixture.store, logger: fixture.logger });

const entryOf = (over: Partial<AdminEntry> = {}): AdminEntry => ({
  at: NOW,
  operatorId: asOperatorId("op_ana"),
  operation: "createMerchant",
  outcome: "accepted",
  ...over,
});

describe("the admin log across a restart", () => {
  it("keeps every entry with its operator, its instant and its outcome, newest first", async () => {
    const entries = log();
    expect(await entries.record(entryOf({ merchantId: asMerchantId("m_uno") }))).toEqual({
      ok: true,
      value: undefined,
    });
    await entries.record(
      entryOf({
        merchantId: asMerchantId("m_uno"),
        at: later(1000),
        operation: "publishMerchantConfiguration",
        outcome: "rejected",
        code: "configuration-frozen",
        reason: "the experiment is active",
        operatorId: asOperatorId("op_beto"),
      }),
    );

    fixture.restart();

    const page = await log().list({ limit: 10 });
    expect(page.items.map((e) => e.operation)).toEqual(["publishMerchantConfiguration", "createMerchant"]);
    const [rejected] = page.items;
    expect(rejected?.outcome).toBe("rejected");
    expect(rejected?.code).toBe("configuration-frozen");
    expect(rejected?.reason).toBe("the experiment is active");
    expect(rejected?.operatorId).toBe("op_beto");
    // An instant, and the operator's own: what a reader sorts and filters by is this and not the row.
    expect(rejected?.at).toEqual(later(1000));
  });

  it("never shows an action of the platform in the log of a merchant", async () => {
    const entries = log();
    await entries.record(entryOf({ operation: "importMerchants", operatorId: asOperatorId("system") }));
    await entries.record(entryOf({ merchantId: asMerchantId("m_dos"), at: later(1000) }));
    await entries.record(entryOf({ merchantId: asMerchantId("m_tres"), at: later(2000) }));

    fixture.restart();

    const after = log();
    const mine = await after.listOf(asMerchantId("m_dos"), { limit: 10 });
    expect(mine.items.map((e) => e.operation)).toEqual(["createMerchant"]);
    expect(mine.items.every((e) => e.merchantId === "m_dos")).toBe(true);
    // The platform action is not lost, it is simply not a merchant's: the global log has the three.
    expect((await after.list({ limit: 10 })).items).toHaveLength(3);
  });

  it("appends, and never repeats: two identical actions are two entries", async () => {
    // There is no business key here on purpose. The same operator can do the same thing twice in the
    // same millisecond — a double click on a list — and both happened.
    const entries = log();
    await entries.record(entryOf({ merchantId: asMerchantId("m_cuatro") }));
    await entries.record(entryOf({ merchantId: asMerchantId("m_cuatro") }));

    fixture.restart();

    expect((await log().listOf(asMerchantId("m_cuatro"), { limit: 10 })).items).toHaveLength(2);
  });

  it("pages by row, and what is appended after the first page does not shift the second", async () => {
    // A cursor that were a position would answer the wrong page as soon as anything is appended, which
    // in an append-only log is every moment.
    const entries = log();
    for (let n = 0; n < 3; n += 1) {
      await entries.record(entryOf({ merchantId: asMerchantId("m_cinco"), at: later(n * 1000) }));
    }

    fixture.restart();

    const after = log();
    const first = await after.list({ limit: 2 });
    expect(first.items.map((e) => e.at)).toEqual([later(2000), later(1000)]);
    expect(first.nextCursor).toBeDefined();

    await after.record(entryOf({ merchantId: asMerchantId("m_cinco"), at: later(9000) }));

    const next = await after.list({ limit: 2, cursor: first.nextCursor });
    expect(next.items.map((e) => e.at)).toEqual([NOW]);
    expect(next.nextCursor).toBeUndefined();
  });

  it("answers that it could not write instead of throwing, which is what reverts the action", async () => {
    // ADR-034: an administration action that cannot be audited does not happen. **Feature 034 changed how
    // that is kept and not whether**: the trail used to be asked beforehand — and answering `writable` was
    // this test — and now the entry and the action are one unit, so what has to be a value rather than an
    // exception is the failure of `record`. It is what tells the decorator to revert.
    const entries = log();
    expect(await entries.record(entryOf())).toEqual({ ok: true, value: undefined });

    fixture.makeUnavailable();

    const refused = await entries.record(entryOf());
    expect(refused.ok).toBe(false);
    expect(refused.ok ? undefined : refused.error.code).toBe("store-unavailable");
    expect(fixture.logged.some((entry) => entry.message.includes("store"))).toBe(true);
  });
});
