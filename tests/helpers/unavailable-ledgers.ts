// Ledgers that return LedgerUnavailable (ADR-021): the memory implementations never do, so the
// degradation path is exercised with these fakes injected as port overrides.
import { LedgerUnavailable } from "../../src/domain/ledger/index.js";
import { fail } from "../../src/domain/shared-kernel/index.js";
import type { CatalogStore } from "../../src/application/catalog/index.js";
import type { AssignmentLedger } from "../../src/application/experiment/index.js";
import type { DecisionLedger, ExposureLedger } from "../../src/application/ledger/index.js";
import type { CorroborationLedger, OrderLedger } from "../../src/application/outcomes/index.js";

const unavailable = () => Promise.resolve(fail(new LedgerUnavailable()));

const nothing = () => Promise.resolve(undefined);

const none = () => Promise.resolve([]);

export const unavailableDecisionLedger = (): DecisionLedger => ({
  record: unavailable,
  find: nothing,
  bySession: none,
});

export const unavailableExposureLedger = (): ExposureLedger => ({ record: unavailable, find: nothing });

export const unavailableAssignmentLedger = (): AssignmentLedger => ({ record: unavailable, find: nothing });

export const unavailableOrderLedger = (): OrderLedger => ({
  record: unavailable,
  recordReturn: unavailable,
  find: nothing,
});

export const unavailableCorroborationLedger = (): CorroborationLedger => ({
  record: unavailable,
  find: none,
});

/** A catalogue store that cannot keep a snapshot (F-044): the platform gets 503 and retries. */
export const unavailableCatalogStore = (): CatalogStore => ({
  current: nothing,
  replace: unavailable,
  receipts: none,
});

/** A ledger that delegates to `inner` while `down()` is false and returns LedgerUnavailable otherwise. */
export function flakyLedger<L extends { record: (...args: never[]) => unknown }>(
  inner: L,
  down: () => boolean,
): L {
  return {
    ...inner,
    record: (...args: never[]) => (down() ? unavailable() : inner.record(...args)),
  };
}

/** A logger that keeps every entry so a test can assert what was reported. */
export function recordingLogger(): {
  logger: { info: LogFn; warn: LogFn; error: LogFn };
  entries: { level: string; fields: Record<string, unknown>; message: string }[];
} {
  const entries: { level: string; fields: Record<string, unknown>; message: string }[] = [];
  const at =
    (level: string): LogFn =>
    (fields, message) => {
      entries.push({ level, fields: { ...fields }, message });
    };
  return { logger: { info: at("info"), warn: at("warn"), error: at("error") }, entries };
}

type LogFn = (fields: Readonly<Record<string, unknown>>, message: string) => void;
