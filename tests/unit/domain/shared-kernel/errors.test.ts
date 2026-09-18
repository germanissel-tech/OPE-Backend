// US3 (FR-020, FR-022; ADR-023): the root of business errors and the Result constructors.
import { describe, expect, it } from "vitest";
import { SessionVisitorMismatch } from "../../../../src/domain/ingestion/index.js";
import { LedgerUnavailable } from "../../../../src/domain/ledger/index.js";
import { DomainError, fail, ok } from "../../../../src/domain/shared-kernel/index.js";

describe("DomainError", () => {
  it("is an Error named after its class, with code, module and message", () => {
    const error = new SessionVisitorMismatch("evt_00000002");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.name).toBe("SessionVisitorMismatch");
    expect(error.code).toBe("session-visitor-mismatch");
    expect(error.module).toBe("ingestion");
    expect(error.message).toContain("evt_00000002");
  });

  it("details are empty unless given, and only safe scalars", () => {
    expect(new LedgerUnavailable().details).toEqual({});
    class WithDetails extends DomainError {
      readonly code = "ledger-unavailable" as const;
      readonly module = "ledger" as const;
    }
    expect(new WithDetails("down", { queued: 3, store: "memory" }).details).toEqual({
      queued: 3,
      store: "memory",
    });
  });
});

describe("ok() / fail()", () => {
  it("produce exactly the discriminated shape", () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
    expect(ok(undefined)).toEqual({ ok: true, value: undefined });
    const error = new LedgerUnavailable();
    expect(fail(error)).toEqual({ ok: false, error });
  });
});
