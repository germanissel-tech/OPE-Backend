// The process lifecycle of a started app (constitution II: fail-closed, also when stopping).
// - A stop signal shuts the app down in order and exits 0; if shutting down fails or takes
//   longer than the grace period a container runtime grants, it exits 1: never a hung process
//   waiting for SIGKILL.
// - An exception nobody caught, or a rejected promise nobody handled, means the process state is
//   unknown: it is logged through the app logger and the process exits 1. No recovery is
//   attempted, because it cannot be trusted.
// The process is a parameter so this can be tested without signals or exits.
import { seconds } from "../domain/shared-kernel/index.js";
import type { Logger } from "../application/shared-kernel/index.js";

/** What a terminal (Ctrl+C) and a container runtime (docker stop, Kubernetes) send to stop the process. */
export const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM"] as const satisfies readonly NodeJS.Signals[];
/** Kubernetes waits 30 s by default before SIGKILL; a shutdown that takes a third of that is stuck. */
const SHUTDOWN_GRACE_SECONDS = 10;
export const SHUTDOWN_TIMEOUT_MS = seconds(SHUTDOWN_GRACE_SECONDS);

/** The part of `process` the lifecycle needs; `process` itself in main, a fake in tests. */
export interface ProcessLike {
  once(event: NodeJS.Signals, listener: () => void): unknown;
  on(event: "uncaughtException" | "unhandledRejection", listener: (error: unknown) => void): unknown;
  exit(code: number): void;
}

export interface Lifecycle {
  logger: Logger;
  close: () => Promise<void>;
}

/** Exit codes: 0 after an orderly shutdown, 1 for anything the process could not trust. */
const EXIT_OK = 0;
const EXIT_FAILURE = 1;

function shutdown(proc: ProcessLike, { logger, close }: Lifecycle, signal: NodeJS.Signals): void {
  logger.info({ signal }, "shutting down");
  const deadline = setTimeout(() => {
    logger.error({ signal, timeoutMs: SHUTDOWN_TIMEOUT_MS }, "shutdown timed out");
    proc.exit(EXIT_FAILURE);
  }, SHUTDOWN_TIMEOUT_MS);
  close().then(
    () => {
      clearTimeout(deadline);
      proc.exit(EXIT_OK);
    },
    (err: unknown) => {
      clearTimeout(deadline);
      logger.error({ err }, "shutdown failed");
      proc.exit(EXIT_FAILURE);
    },
  );
}

export function attachLifecycle(proc: ProcessLike, lifecycle: Lifecycle): void {
  for (const signal of SHUTDOWN_SIGNALS) {
    proc.once(signal, () => {
      shutdown(proc, lifecycle, signal);
    });
  }
  proc.on("uncaughtException", (err) => {
    lifecycle.logger.error({ err }, "uncaught exception; exiting");
    proc.exit(EXIT_FAILURE);
  });
  proc.on("unhandledRejection", (err) => {
    lifecycle.logger.error({ err }, "unhandled rejection; exiting");
    proc.exit(EXIT_FAILURE);
  });
}
