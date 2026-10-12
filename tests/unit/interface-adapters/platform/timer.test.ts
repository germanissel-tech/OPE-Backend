// Feature 044 (research R-03): the timer of the scheduler ticks at the level-1 value read when each tick is set,
// starts only when the boot says so, never starts a run under another, and closing it waits for the run in
// progress.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schedulerTimer, type PlatformScheduler } from "../../../../src/interface-adapters/platform/index.js";
import { TEST_NOW } from "../../../helpers/merchants.js";

const quiet = { info: () => undefined, warn: () => undefined, error: () => undefined };
const clock = { now: () => TEST_NOW };

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function counting(run: () => Promise<void> = () => Promise.resolve()) {
  const runs: Date[] = [];
  const scheduler: PlatformScheduler = {
    runDue: (now) => {
      runs.push(now);
      return run();
    },
  };
  return { runs, scheduler };
}

describe("schedulerTimer", () => {
  it("does nothing until it is started, and then ticks at the value read when each tick is set", async () => {
    const { runs, scheduler } = counting();
    let tick = 1_000;
    const timer = schedulerTimer({ scheduler, clock, logger: quiet, tickMs: () => tick });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(runs).toHaveLength(0);
    timer.start();
    await vi.advanceTimersByTimeAsync(999);
    expect(runs).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(runs).toEqual([TEST_NOW]);
    tick = 3_000;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(runs).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2_999);
    expect(runs).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(runs).toHaveLength(3);
    await timer.close();
  });

  it("does not start a run under one that has not finished, and closing waits for it", async () => {
    let release: () => void = () => undefined;
    const { runs, scheduler } = counting(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const timer = schedulerTimer({ scheduler, clock, logger: quiet, tickMs: () => 100 });
    timer.start();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(runs).toHaveLength(1);
    let closed = false;
    const closing = timer.close().then(() => {
      closed = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(closed).toBe(false);
    release();
    await closing;
    expect(closed).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(runs).toHaveLength(1);
  });

  it("a tick that throws is logged, and the next one is still set", async () => {
    const errors: string[] = [];
    const logger = { ...quiet, error: (_: unknown, message: string) => errors.push(message) };
    const { runs, scheduler } = counting(() => Promise.reject(new Error("boom")));
    const timer = schedulerTimer({ scheduler, clock, logger, tickMs: () => 100 });
    timer.start();
    await vi.advanceTimersByTimeAsync(200);
    expect(runs).toHaveLength(2);
    expect(errors[0]).toBe("The platform scheduler could not finish a tick.");
    await timer.close();
  });

  it("a timer closed before it was started never starts", async () => {
    const { runs, scheduler } = counting();
    const timer = schedulerTimer({ scheduler, clock, logger: quiet, tickMs: () => 100 });
    await timer.close();
    timer.start();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(runs).toHaveLength(0);
  });

  it("is not the reason a process stays up", () => {
    const unref = vi.fn();
    const set = vi.spyOn(globalThis, "setTimeout").mockReturnValue({ unref } as unknown as NodeJS.Timeout);
    const timer = schedulerTimer({
      scheduler: counting().scheduler,
      clock,
      logger: quiet,
      tickMs: () => 100,
    });
    timer.start();
    expect(unref).toHaveBeenCalledTimes(1);
    set.mockRestore();
  });
});
