// Feature 017 — the in-memory admin log and its paging.
import { describe, expect, it } from "vitest";
import { asOperatorId } from "../../../../src/domain/operator/index.js";
import { asMerchantId, type AuditEntry } from "../../../../src/domain/shared-kernel/index.js";
import { memoryAdminLog } from "../../../../src/interface-adapters/admin/gateways/memory-admin-log.js";
import { pageOf } from "../../../../src/interface-adapters/shared-kernel/paging.js";
import type { AdminEntry } from "../../../../src/domain/admin/index.js";

const A = asMerchantId("mrc_a");
const B = asMerchantId("mrc_b");
const entry = (n: number, merchantId = A): AdminEntry => ({
  at: new Date(n * 1000),
  operatorId: asOperatorId("ops"),
  operation: `op${n}`,
  merchantId,
  outcome: "accepted",
});

describe("memoryAdminLog", () => {
  // Feature 020, US6 (ADR-034): the audit trail is the kernel's port and writes the actor as text
  // —the kernel cannot see the identity it belongs to—; this gateway is the one border that types
  // it again, and what is read back is an entry of the administration, identical in every field.
  it("an entry written through the kernel's port reads back with its operator, field by field", async () => {
    const log = memoryAdminLog();
    const written: AuditEntry = {
      at: new Date(1000),
      operatorId: "ops",
      operation: "publishMerchantConfiguration",
      merchantId: A,
      outcome: "accepted",
      result: { configurationVersion: 2 },
    };
    await log.record(written);
    const [read] = (await log.list({ limit: 1 })).items;
    expect(read).toStrictEqual({ ...written, operatorId: asOperatorId("ops") });
  });

  it("lists newest first, pages by cursor and filters by merchant", async () => {
    const log = memoryAdminLog();
    for (const n of [1, 2, 3]) await log.record(entry(n, n === 2 ? B : A));
    const first = await log.list({ limit: 2 });
    expect(first.items.map((e) => e.operation)).toEqual(["op3", "op2"]);
    expect(first.nextCursor).toBe("2");
    const second = await log.list({ cursor: first.nextCursor, limit: 2 });
    expect(second.items.map((e) => e.operation)).toEqual(["op1"]);
    expect(second.nextCursor).toBeUndefined();
    expect((await log.listOf(B, { limit: 10 })).items.map((e) => e.operation)).toEqual(["op2"]);
  });

  it("a page that ends exactly at the last item has no next cursor", () => {
    expect(pageOf([1, 2], { limit: 2 })).toEqual({ items: [1, 2] });
    expect(pageOf([1, 2, 3], { cursor: "1", limit: 2 })).toEqual({ items: [2, 3] });
  });

  it("pageOf ignores a malformed cursor, a limit below 1 and caps the page", () => {
    const items = Array.from({ length: 250 }, (_, i) => i);
    expect(pageOf(items, { cursor: "x", limit: 0 }).items).toEqual([0]);
    expect(pageOf(items, { limit: 1000 }).items).toHaveLength(200);
    expect(pageOf(items, { cursor: "-3", limit: 1 }).items).toEqual([0]);
  });
});
