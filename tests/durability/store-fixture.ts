// What every test of this suite needs: a store on a real file, and a way to **close it and open it
// again**, which is the whole point of the suite. A store in memory would prove nothing here — it
// is the file surviving the process that is under test.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openSqliteStore } from "../../src/infrastructure/sqlite/open-store.js";
import type { Logger } from "../../src/application/shared-kernel/index.js";
import type { SqlStore } from "../../src/interface-adapters/shared-kernel/index.js";

export interface Restartable {
  /** The store as it is now. After `restart()` this is a different one over the same file. */
  store: SqlStore;
  /** What the gateways logged: a write that degraded says why exactly here (ADR-021). */
  readonly logged: { fields: Record<string, unknown>; message: string }[];
  readonly logger: Logger;
  /** Closes the store and opens the same file again: what a deploy or a crash does. */
  restart(): void;
  /**
   * Leaves the store unable to accept anything, which is the edge case of ADR-021 seen from a
   * gateway. It is a gesture of its own rather than a bare `close()` so the teardown knows the
   * store is already gone and does not fail cleaning up after a test that passed.
   */
  makeUnavailable(): void;
  dispose(): void;
}

export function restartableStore(): Restartable {
  const dir = mkdtempSync(path.join(tmpdir(), "ope-durability-"));
  const file = path.join(dir, "ope.db");
  const logged: { fields: Record<string, unknown>; message: string }[] = [];
  // One recorder for the three levels: what a test asserts on is what was said, not how loudly.
  const record = (fields: Record<string, unknown>, message: string): void => {
    logged.push({ fields, message });
  };
  let open = true;
  const fixture: Restartable = {
    store: openSqliteStore({ file }),
    logged,
    logger: { info: record, warn: record, error: record },
    restart() {
      fixture.store.close();
      fixture.store = openSqliteStore({ file });
      open = true;
    },
    makeUnavailable() {
      fixture.store.close();
      open = false;
    },
    dispose() {
      if (open) fixture.store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
  return fixture;
}
