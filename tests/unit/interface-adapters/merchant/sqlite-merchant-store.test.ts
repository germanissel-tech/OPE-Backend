// Feature 033: the durable merchant store answers its reads from an in-memory index, and **what this
// file is about is the one rule that keeps that sound** — the index is a view of what the store accepted,
// so it is touched after a successful write and never before.
//
// It is here and not in the durability suite because it needs a store that **refuses**, and the point is
// not that the file survives a restart but that a refused write leaves the index alone. A gateway that
// updated the index first would answer with a merchant the table does not have, and nothing downstream
// could tell.
import { describe, expect, it } from "vitest";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";
import { memoryMerchantStore } from "../../../../src/interface-adapters/merchant/gateways/memory-merchant-store.js";
import { sqliteMerchantStore } from "../../../../src/interface-adapters/merchant/gateways/sqlite-merchant-store.js";
import { fingerprintOf, testMerchant } from "../../../helpers/merchants.js";
import type { Logger } from "../../../../src/application/shared-kernel/index.js";
import type { SqlStore } from "../../../../src/interface-adapters/shared-kernel/index.js";

const NOW = new Date("2026-09-29T10:00:00.000Z");

/**
 * A store that answers the load with `rows` and either accepts or refuses every write. `statements`
 * records what it was asked, which is how "the index was not read again" is checked without reaching
 * inside the gateway.
 */
function subject(options: { rows?: readonly string[]; refuses?: boolean } = {}) {
  const statements: string[] = [];
  const logged: { fields: Record<string, unknown>; message: string }[] = [];
  const store: SqlStore = {
    all: (sql) => {
      statements.push(sql);
      return (options.rows ?? []).map((document) => ({ document }));
    },
    run: (sql) => {
      statements.push(sql);
      if (options.refuses === true) throw new Error("UNIQUE constraint failed: merchant_origins.origin");
    },
    transaction: (work) => work(),
    close: () => undefined,
  };
  const logger: Logger = {
    info: () => undefined,
    warn: () => undefined,
    error: (fields, message) => logged.push({ fields, message }),
  };
  const merchants = sqliteMerchantStore({ store, logger, index: memoryMerchantStore() });
  return { merchants, statements, logged };
}

describe("sqliteMerchantStore", () => {
  it("fills its index once, when it is built, and never reads the table again", async () => {
    const stored = testMerchant({
      merchantId: "m_uno",
      ingestKeys: ["key-1"],
      origins: ["https://uno.example"],
    });
    const { merchants, statements } = subject({ rows: [JSON.stringify(stored.record())] });
    // One read at construction, and it is a `SELECT`.
    expect(statements.filter((sql) => sql.startsWith("SELECT"))).toHaveLength(1);

    // Every lookup the hot path makes, and none of them adds a statement.
    expect((await merchants.get(asMerchantId("m_uno")))?.merchantId).toBe("m_uno");
    expect((await merchants.findByIngestKey(fingerprintOf("key-1"), NOW))?.merchantId).toBe("m_uno");
    expect(await merchants.ownerOfOrigin("https://uno.example")).toBe("m_uno");
    expect(await merchants.isRegisteredOrigin("https://uno.example")).toBe(true);
    expect((await merchants.list({ limit: 10 })).items).toHaveLength(1);
    expect(await merchants.isEmpty()).toBe(false);

    expect(statements.filter((sql) => sql.startsWith("SELECT"))).toHaveLength(1);
  });

  it("updates the index after the store accepted", async () => {
    const { merchants } = subject();
    const merchant = testMerchant({
      merchantId: "m_dos",
      ingestKeys: ["key-2"],
      origins: ["https://dos.example"],
    });

    expect(await merchants.create(merchant)).toEqual({ ok: true, value: undefined });

    expect((await merchants.findByIngestKey(fingerprintOf("key-2"), NOW))?.merchantId).toBe("m_dos");
    expect(await merchants.ownerOfOrigin("https://dos.example")).toBe("m_dos");
    expect(await merchants.isEmpty()).toBe(false);
  });

  it("leaves the index untouched when the store refused, so it never answers what was not written", async () => {
    // The rule of this file. A refused write that had already updated the index would make the gateway
    // authenticate a merchant the table does not hold — and with the index answering every request, the
    // table would never be consulted to find out.
    const { merchants, logged } = subject({ refuses: true });
    const merchant = testMerchant({
      merchantId: "m_tres",
      ingestKeys: ["key-3"],
      origins: ["https://tres.example"],
    });

    const refused = await merchants.create(merchant);
    expect(refused.ok).toBe(false);
    expect(refused.ok ? undefined : refused.error.code).toBe("store-unavailable");

    expect(await merchants.get(asMerchantId("m_tres"))).toBeUndefined();
    expect(await merchants.findByIngestKey(fingerprintOf("key-3"), NOW)).toBeUndefined();
    expect(await merchants.ownerOfOrigin("https://tres.example")).toBeUndefined();
    // And **`isEmpty` still says empty**, which is the one with a consequence at boot: a seed that read
    // a non-empty store after a failed write would never import anything.
    expect(await merchants.isEmpty()).toBe(true);
    expect(logged).toHaveLength(1);
  });

  it("leaves the index untouched when an update is refused, keeping what was already there", async () => {
    // The other half: a refused `update` must not leave the index holding the version the store rejected,
    // which would be worse than a refused `create` — the merchant exists, so the wrong facts would answer.
    const merchant = testMerchant({
      merchantId: "m_cuatro",
      ingestKeys: ["vieja"],
      origins: ["https://cuatro.example"],
    });
    const { merchants } = subject({ rows: [JSON.stringify(merchant.record())], refuses: true });

    const refused = await merchants.update(merchant.deactivated());
    expect(refused.ok).toBe(false);

    expect((await merchants.get(asMerchantId("m_cuatro")))?.isDeactivated()).toBe(false);
    expect(await merchants.isRegisteredOrigin("https://cuatro.example")).toBe(true);
  });
});
