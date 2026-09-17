// Lint fixture: violates only the rule in its name.
export function swallow(run: () => void, log: (m: string) => void): void {
  try {
    log("running");
    run();
  } catch (err) {}
}
