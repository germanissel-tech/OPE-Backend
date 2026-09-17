// Constitution II (fail-closed) at the process level: a stop signal shuts down in order and exits
// 0; a failed or stuck shutdown, an uncaught exception or an unhandled rejection exit 1 after
// being logged. The process is a fake: nothing here sends signals or exits.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachLifecycle,
  SHUTDOWN_SIGNALS,
  SHUTDOWN_TIMEOUT_MS,
  type ProcessLike,
} from "../../../src/composition/lifecycle.js";
import type { LogFields, Logger } from "../../../src/application/shared-kernel/index.js";

interface Fake extends ProcessLike {
  signal(name: NodeJS.Signals): void;
  raise(event: "uncaughtException" | "unhandledRejection", error: unknown): void;
  exits: number[];
}

function fakeProcess(): Fake {
  const listeners = new Map<string, ((error?: unknown) => void)[]>();
  const add = (event: string, listener: (error?: unknown) => void): void => {
    listeners.set(event, [...(listeners.get(event) ?? []), listener]);
  };
  const exits: number[] = [];
  return {
    exits,
    once: (event, listener) => {
      add(event, listener);
    },
    on: (event, listener) => {
      add(event, listener);
    },
    exit: (code) => exits.push(code),
    signal: (name) => {
      (listeners.get(name) ?? []).forEach((l) => {
        l();
      });
    },
    raise: (event, error) => {
      (listeners.get(event) ?? []).forEach((l) => {
        l(error);
      });
    },
  };
}

function capturingLogger(): {
  lines: { level: string; fields: LogFields; message: string }[];
  logger: Logger;
} {
  const lines: { level: string; fields: LogFields; message: string }[] = [];
  const at = (level: string) => (fields: LogFields, message: string) => {
    lines.push({ level, fields, message });
  };
  return { lines, logger: { info: at("info"), warn: at("warn"), error: at("error") } };
}

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe("attachLifecycle", () => {
  beforeEach(() => {
    // Only the deadline timer is faked; promise continuations and setImmediate stay real.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers both stop signals and both error events", () => {
    const proc = fakeProcess();
    const once = vi.spyOn(proc, "once");
    const on = vi.spyOn(proc, "on");
    attachLifecycle(proc, { logger: capturingLogger().logger, close: () => Promise.resolve() });
    expect(once.mock.calls.map((c) => c[0])).toEqual([...SHUTDOWN_SIGNALS]);
    expect(on.mock.calls.map((c) => c[0])).toEqual(["uncaughtException", "unhandledRejection"]);
  });

  it("a stop signal closes the app in order and exits 0", async () => {
    const proc = fakeProcess();
    const { lines, logger } = capturingLogger();
    const close = vi.fn(() => Promise.resolve());
    attachLifecycle(proc, { logger, close });
    proc.signal("SIGTERM");
    await flush();
    expect(close).toHaveBeenCalledTimes(1);
    expect(lines).toEqual([{ level: "info", fields: { signal: "SIGTERM" }, message: "shutting down" }]);
    expect(proc.exits).toEqual([0]);
  });

  it("a close() that rejects is logged with its cause and exits 1", async () => {
    const proc = fakeProcess();
    const { lines, logger } = capturingLogger();
    const cause = new Error("pool did not drain");
    attachLifecycle(proc, { logger, close: () => Promise.reject(cause) });
    proc.signal("SIGINT");
    await flush();
    expect(lines.at(-1)).toEqual({ level: "error", fields: { err: cause }, message: "shutdown failed" });
    expect(proc.exits).toEqual([1]);
  });

  it("a close() that never settles exits 1 after the grace period, with the timeout in the log", async () => {
    const proc = fakeProcess();
    const { lines, logger } = capturingLogger();
    attachLifecycle(proc, { logger, close: () => new Promise(() => undefined) });
    proc.signal("SIGTERM");
    await vi.advanceTimersByTimeAsync(SHUTDOWN_TIMEOUT_MS - 1);
    expect(proc.exits).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(lines.at(-1)).toEqual({
      level: "error",
      fields: { signal: "SIGTERM", timeoutMs: SHUTDOWN_TIMEOUT_MS },
      message: "shutdown timed out",
    });
    expect(proc.exits).toEqual([1]);
  });

  it("a close() that settles in time cancels the deadline: exactly one exit", async () => {
    const proc = fakeProcess();
    attachLifecycle(proc, { logger: capturingLogger().logger, close: () => Promise.resolve() });
    proc.signal("SIGTERM");
    await flush();
    await vi.advanceTimersByTimeAsync(SHUTDOWN_TIMEOUT_MS + 1);
    expect(proc.exits).toEqual([0]);
  });

  it("an uncaught exception and an unhandled rejection are logged and exit 1 without closing", () => {
    const proc = fakeProcess();
    const { lines, logger } = capturingLogger();
    const close = vi.fn(() => Promise.resolve());
    attachLifecycle(proc, { logger, close });
    const boom = new Error("boom");
    proc.raise("uncaughtException", boom);
    proc.raise("unhandledRejection", "reason");
    expect(lines).toEqual([
      { level: "error", fields: { err: boom }, message: "uncaught exception; exiting" },
      { level: "error", fields: { err: "reason" }, message: "unhandled rejection; exiting" },
    ]);
    expect(proc.exits).toEqual([1, 1]);
    expect(close).not.toHaveBeenCalled();
  });
});
