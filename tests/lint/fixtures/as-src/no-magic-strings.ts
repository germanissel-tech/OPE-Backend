// Lint fixture (as if under src/): violates only the rule in its name. The signal name is written
// twice and the second time nothing checks it: `shutdown` takes any string.
declare function shutdown(signal: string): void;

export function install(): void {
  process.once("SIGTERM", () => {
    shutdown("SIGTERM");
  });
}
