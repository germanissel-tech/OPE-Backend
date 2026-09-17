// Eval fixture: the signal names are written twice each, and the second time `shutdown` takes any
// string (the pre-005 start.ts, condensed). The list of signals has no name either.
interface Closable {
  close(): Promise<void>;
}

export function install(app: Closable, log: (fields: { signal: string }, message: string) => void): void {
  const shutdown = (signal: string): void => {
    log({ signal }, "shutting down");
    void app.close().then(() => process.exit(0));
  };
  process.once("SIGINT", () => {
    shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    shutdown("SIGTERM");
  });
}
