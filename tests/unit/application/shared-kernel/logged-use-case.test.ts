// Feature 008, US5 (FR-040; ADR-023): the logging decorator wraps any use case and reports name, duration
// and outcome — never the request.
import { describe, expect, it } from "vitest";
import { LoggedUseCase, type UseCase } from "../../../../src/application/shared-kernel/index.js";
import { LedgerUnavailable } from "../../../../src/domain/ledger/index.js";
import { fail, ok, type Result } from "../../../../src/domain/shared-kernel/index.js";
import { recordingLogger } from "../../../helpers/unavailable-ledgers.js";

const STEP_MS = 7;

/** A clock that advances STEP_MS on every read. */
function tickingClock() {
  let t = new Date("2026-09-17T12:00:00.000Z").getTime();
  return {
    now: () => {
      const at = new Date(t);
      t += STEP_MS;
      return at;
    },
  };
}

interface Request {
  visitorId: string;
}

describe("LoggedUseCase", () => {
  it("logs name, duration and `ok` for a successful Result, without the request", async () => {
    const inner: UseCase<Request, Result<number, LedgerUnavailable>> = {
      execute: () => Promise.resolve(ok(1)),
    };
    const { logger, entries } = recordingLogger();
    const logged = new LoggedUseCase("demo", inner, { clock: tickingClock(), logger });
    expect(await logged.execute({ visitorId: "vis_00000001" })).toEqual({ ok: true, value: 1 });
    expect(entries).toEqual([
      {
        level: "info",
        fields: { useCase: "demo", durationMs: STEP_MS, outcome: "ok" },
        message: "use case executed",
      },
    ]);
    expect(JSON.stringify(entries)).not.toContain("vis_00000001");
  });

  it("logs the code of a failed Result and returns it untouched", async () => {
    const error = new LedgerUnavailable();
    const inner: UseCase<void, Result<number, LedgerUnavailable>> = {
      execute: () => Promise.resolve(fail(error)),
    };
    const { logger, entries } = recordingLogger();
    const logged = new LoggedUseCase("demo", inner, { clock: tickingClock(), logger });
    expect(await logged.execute()).toEqual({ ok: false, error });
    expect(entries[0]?.fields).toMatchObject({ useCase: "demo", outcome: "ledger-unavailable" });
    expect(JSON.stringify(entries)).not.toContain("details");
  });

  it("a response that is not a Result is `ok`: an object, nothing at all, null, or a false `ok` without a DomainError", async () => {
    const cases: UseCase<void, unknown>[] = [
      { execute: () => Promise.resolve({ status: "fine" }) },
      { execute: () => Promise.resolve(undefined) },
      { execute: () => Promise.resolve(null) },
      { execute: () => Promise.resolve({ ok: false, error: new Error("not a business error") }) },
    ];
    for (const inner of cases) {
      const { logger, entries } = recordingLogger();
      await new LoggedUseCase("health", inner, { clock: tickingClock(), logger }).execute();
      expect(entries[0]?.fields).toMatchObject({ useCase: "health", outcome: "ok" });
    }
  });
});
