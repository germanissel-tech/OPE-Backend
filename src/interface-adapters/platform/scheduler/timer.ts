// The timer that runs the scheduler (feature 044; research R-03), and what the graph closes at shutdown.
//
// The same shape as the register's queue (feature 031): **unreferenced**, so the scheduler is never the reason
// a process stays up, and a `close` the graph calls before the store, because it was built after it. A chain of
// timeouts and not an interval, for two reasons: the tick is level 1 and is read each time one is set, so a new
// version counts without a restart; and the next tick is set when a run ends, so a slow run never has a second
// one started under it.
import type { PlatformScheduler } from "./scheduler.js";
import type { Clock, Logger } from "../../../application/shared-kernel/index.js";

export interface SchedulerTimerDeps {
  scheduler: PlatformScheduler;
  clock: Clock;
  logger: Logger;
  /** How often it looks at what is due (level 1, `platformSyncTickMs`). */
  tickMs: () => number;
}

export interface SchedulerTimer {
  /**
   * Sets the first tick. Not done at construction, because the tick is level 1 and the graph builds this before
   * the boot has read the levels: the boot starts it once they are in force.
   */
  start(): void;
  /** Stops the timer and waits for the run in progress: the store closes after it, not under it. */
  close(): Promise<void>;
}

export function schedulerTimer(deps: SchedulerTimerDeps): SchedulerTimer {
  let closed = false;
  let current: Promise<void> | undefined;
  let timer: NodeJS.Timeout | undefined;

  const schedule = (): void => {
    timer = setTimeout(tick, deps.tickMs());
    timer.unref();
  };

  function tick(): void {
    current = deps.scheduler
      .runDue(deps.clock.now())
      .catch((cause: unknown) => {
        deps.logger.error(
          { cause: cause instanceof Error ? cause.message : String(cause) },
          "The platform scheduler could not finish a tick.",
        );
      })
      .finally(() => {
        current = undefined;
        if (!closed) schedule();
      });
  }

  return {
    start() {
      if (!closed) schedule();
    },
    async close() {
      closed = true;
      clearTimeout(timer);
      await current;
    },
  };
}
