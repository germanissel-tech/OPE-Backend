// Feature 017 — FR-008: every administration action leaves an entry in the admin log.
import { describe, expect, it } from "vitest";
import {
  AuditedUseCase,
  type AdminRequest,
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
  type Result,
} from "../../../../src/domain/shared-kernel/index.js";
import { memoryAdminLog } from "../../../../src/interface-adapters/admin/gateways/memory-admin-log.js";

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
type Res = Result<{ version: number }, MerchantOutOfScope | IdempotencyConflict>;

const audited = (inner: UseCase<Req, Res>) => {
  const log = memoryAdminLog();
  const useCase = new AuditedUseCase<Req, Res>(
    "publishMerchantConfiguration",
    inner,
    { log, clock: { now: () => NOW } },
    {
      result: (r) => (r.ok ? { configurationVersion: r.value.version } : undefined),
      reason: (q) => q.reason,
    },
  );
  return { useCase, log };
};

describe("AuditedUseCase", () => {
  it("records an accepted action with actor, merchant, result and the declared reason", async () => {
    const { useCase, log } = audited({ execute: () => Promise.resolve(ok({ version: 3 })) });
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
  });

  it("records a rejection with the error code and no result, even if the reader would produce one", async () => {
    const log = memoryAdminLog();
    const useCase = new AuditedUseCase<Req, Res>(
      "publishMerchantConfiguration",
      { execute: () => Promise.resolve(fail(new IdempotencyConflict("x"))) },
      { log, clock: { now: () => NOW } },
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

  it("records a scope denial as denied", async () => {
    const { useCase, log } = audited({ execute: () => Promise.resolve(fail(new MerchantOutOfScope())) });
    const response = await useCase.execute({ actor, merchantId: A });
    expect(response.ok).toBe(false);
    expect((await log.list({ limit: 10 })).items[0]).toMatchObject({
      outcome: "denied",
      code: "merchant-out-of-scope",
    });
  });

  it("a response that is not a Result counts as accepted, without merchant when the request names none", async () => {
    const log = memoryAdminLog();
    const useCase = new AuditedUseCase<AdminRequest, number>(
      "listMerchants",
      { execute: () => Promise.resolve(1) },
      { log, clock: { now: () => NOW } },
    );
    await useCase.execute({ actor });
    const entry = (await log.list({ limit: 10 })).items[0];
    expect(entry).toMatchObject({ outcome: "accepted", operation: "listMerchants" });
    expect(entry?.merchantId).toBeUndefined();
  });
});
