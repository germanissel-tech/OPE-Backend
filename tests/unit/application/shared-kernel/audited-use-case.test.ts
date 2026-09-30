// Feature 017 — FR-008: every administration action leaves an entry in the admin log.
//
// **Feature 034 added the three cases that decide whether it audits what it must.** The action and its
// entry now run inside one unit of work, and the interesting part is not that they commit together — it is
// **what does not abort**: a business rejection is something an operator did and its entry has to stay.
// Getting that backwards would revert precisely what ADR-034 exists to record.
import { describe, expect, it } from "vitest";
import {
  AuditedUseCase,
  type AdminRequest,
  type AuditTrail,
  type UnitOfWork,
  type UseCase,
} from "../../../../src/application/shared-kernel/index.js";
import {
  asOperatorId,
  EVERY_MERCHANT,
  MerchantOutOfScope,
  Operator,
} from "../../../../src/domain/operator/index.js";
import {
  asMerchantId,
  fail,
  IdempotencyConflict,
  ok,
  StoreUnavailable,
  type Result,
} from "../../../../src/domain/shared-kernel/index.js";
import { memoryAdminLog } from "../../../../src/interface-adapters/admin/gateways/memory-admin-log.js";
import type { AdminLog } from "../../../../src/application/admin/index.js";

const NOW = new Date("2026-09-20T12:00:00.000Z");
const actor = Operator.rehydrate({
  operatorId: asOperatorId("ops-1"),
  tokenFingerprints: ["f"],
  scope: EVERY_MERCHANT,
});
const A = asMerchantId("mrc_a");

interface Req extends AdminRequest {
  reason?: string;
}
type Res = Result<{ version: number }, MerchantOutOfScope | IdempotencyConflict | StoreUnavailable>;

/**
 * A unit of work that records what was asked of it. It is the real shape and not a pass-through, because
 * **whether it was told to revert is the assertion** of half this file.
 */
function watchedUnit() {
  const asked = { opened: false, aborted: false };
  const unit: UnitOfWork = {
    scope: async (work) => {
      asked.opened = true;
      const value = await work(() => {
        asked.aborted = true;
      });
      return asked.aborted ? fail(new StoreUnavailable()) : ok(value);
    },
  };
  return { unit, asked };
}

/** A trail that cannot be written to: the failure this feature exists to make impossible to ignore. */
const refusingTrail = (): AuditTrail => ({ record: () => Promise.resolve(fail(new StoreUnavailable())) });

const audited = (inner: UseCase<Req, Res>, log: AuditTrail | AdminLog = memoryAdminLog()) => {
  const watched = watchedUnit();
  const useCase = new AuditedUseCase<Req, Res>(
    "publishMerchantConfiguration",
    inner,
    { log, clock: { now: () => NOW }, unit: watched.unit },
    {
      result: (r) => (r.ok ? { configurationVersion: r.value.version } : undefined),
      reason: (q) => q.reason,
    },
  );
  return { useCase, log, asked: watched.asked };
};

describe("AuditedUseCase", () => {
  it("records an accepted action with actor, merchant, result and the declared reason", async () => {
    const log = memoryAdminLog();
    const { useCase, asked } = audited({ execute: () => Promise.resolve(ok({ version: 3 })) }, log);
    await useCase.execute({ actor, merchantId: A, reason: "anchor fix" });
    expect((await log.list({ limit: 10 })).items).toEqual([
      {
        at: NOW,
        operatorId: "ops-1",
        operation: "publishMerchantConfiguration",
        merchantId: A,
        outcome: "accepted",
        result: { configurationVersion: 3 },
        reason: "anchor fix",
      },
    ]);
    // The action and the entry were one unit, and nothing was reverted.
    expect(asked).toEqual({ opened: true, aborted: false });
  });

  it("records a rejection with the error code and no result, even if the reader would produce one", async () => {
    const log = memoryAdminLog();
    const watched = watchedUnit();
    const useCase = new AuditedUseCase<Req, Res>(
      "publishMerchantConfiguration",
      { execute: () => Promise.resolve(fail(new IdempotencyConflict("x"))) },
      { log, clock: { now: () => NOW }, unit: watched.unit },
      { result: () => ({ configurationVersion: 9 }) },
    );
    await useCase.execute({ actor, merchantId: A });
    expect((await log.list({ limit: 10 })).items[0]).toStrictEqual({
      at: NOW,
      operatorId: "ops-1",
      operation: "publishMerchantConfiguration",
      merchantId: A,
      outcome: "rejected",
      code: "idempotency-conflict",
    });
  });

  it("**does not revert** a business rejection: its entry is the point", async () => {
    // The case that decides the design. A rejection is a failed `Result`, so a unit that reverted on any
    // failure would erase the entry of the action an operator most needs to see — and the action itself
    // wrote nothing, so there is nothing to undo.
    const log = memoryAdminLog();
    const { useCase, asked } = audited(
      { execute: () => Promise.resolve(fail(new IdempotencyConflict("x"))) },
      log,
    );

    const response = await useCase.execute({ actor, merchantId: A });

    expect(response.ok).toBe(false);
    expect(asked.aborted).toBe(false);
    expect((await log.list({ limit: 10 })).items).toHaveLength(1);
  });

  it("reverts the action when the trail could not be written, and answers that failure", async () => {
    // The window ADR-034 leaves open, closed: the action already wrote when the entry failed, so the unit
    // is told to revert **and** the response of the operation is the unavailability — not the success the
    // inner use case answered, which would tell the operator something that no longer happened.
    const { useCase, asked } = audited(
      { execute: () => Promise.resolve(ok({ version: 3 })) },
      refusingTrail(),
    );

    const response = await useCase.execute({ actor, merchantId: A });

    expect(asked.aborted).toBe(true);
    expect(response.ok).toBe(false);
    expect(response.ok ? undefined : response.error.code).toBe("store-unavailable");
  });

  it("records a scope denial as denied", async () => {
    const log = memoryAdminLog();
    const { useCase } = audited({ execute: () => Promise.resolve(fail(new MerchantOutOfScope())) }, log);
    const response = await useCase.execute({ actor, merchantId: A });
    expect(response.ok).toBe(false);
    expect((await log.list({ limit: 10 })).items[0]).toMatchObject({
      outcome: "denied",
      code: "merchant-out-of-scope",
    });
  });

  it("a response that is not a Result counts as accepted, without merchant when the request names none", async () => {
    const log = memoryAdminLog();
    const watched = watchedUnit();
    const useCase = new AuditedUseCase<AdminRequest, number>(
      "listMerchants",
      { execute: () => Promise.resolve(1) },
      { log, clock: { now: () => NOW }, unit: watched.unit },
    );
    await useCase.execute({ actor });
    const entry = (await log.list({ limit: 10 })).items[0];
    expect(entry).toMatchObject({ outcome: "accepted", operation: "listMerchants" });
    expect(entry?.merchantId).toBeUndefined();
  });
});
