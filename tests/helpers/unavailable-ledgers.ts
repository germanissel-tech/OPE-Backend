// Ledgers that return LedgerUnavailable (ADR-021): the memory implementations never do, so the
// degradation path is exercised with these fakes injected as port overrides.
import { LedgerUnavailable } from "../../src/domain/ledger/index.js";
import { asOperatorId } from "../../src/domain/operator/index.js";
import { fail, ok, StoreUnavailable } from "../../src/domain/shared-kernel/index.js";
import { pageOf } from "../../src/interface-adapters/shared-kernel/index.js";
import type { AdminLog } from "../../src/application/admin/index.js";
import type { CatalogStore } from "../../src/application/catalog/index.js";
import type { AssignmentLedger } from "../../src/application/experiment/index.js";
import type { DecisionLedger, ExposureLedger } from "../../src/application/ledger/index.js";
import type { CorroborationLedger, OrderLedger } from "../../src/application/outcomes/index.js";
import type { AdminEntry } from "../../src/domain/admin/index.js";

const unavailable = () => Promise.resolve(fail(new LedgerUnavailable()));

const nothing = () => Promise.resolve(undefined);

const none = () => Promise.resolve([]);

/**
 * An administration log that accepts nothing (feature 021). What the tests around it prove is not
 * the response code but the **order**: the action must not have happened. `record` refuses too, so
 * an implementation that asks after acting instead of before is caught here.
 */
export const unavailableAdminLog = (): AdminLog => refusingAdminLog(true).log;

/**
 * A log that can be switched off after the boot. The seed of the boot is an administration action
 * too, so a server whose log refuses from the start never finishes starting; a test about what the
 * **server** answers needs one that starts writable.
 */
export function refusingAdminLog(refusing = false): { log: AdminLog; refuse: () => void } {
  const entries: AdminEntry[] = [];
  let off = refusing;
  const refused = () => Promise.resolve(fail(new StoreUnavailable()));
  return {
    refuse: () => {
      off = true;
    },
    log: {
      writable: () => (off ? refused() : Promise.resolve(ok(undefined))),
      record: (entry) => {
        if (off) return refused();
        entries.push({ ...entry, operatorId: asOperatorId(entry.operatorId) });
        return Promise.resolve(ok(undefined));
      },
      list: (query) => Promise.resolve(pageOf([...entries].reverse(), query)),
      listOf: (merchantId, query) =>
        Promise.resolve(pageOf(entries.filter((e) => e.merchantId === merchantId).reverse(), query)),
    },
  };
}

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
