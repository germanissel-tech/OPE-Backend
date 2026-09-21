// What every module of the administration wraps its use cases with (ADR-023, ADR-031): the log
// of the operation (name, duration, outcome) and, for what an operator does, the admin log
// entry that is written whether the action was accepted, rejected or denied.
import {
  AuditedUseCase,
  type AdminLog,
  type AdminRequest,
  type AuditedUseCaseReaders,
} from "../../application/admin/index.js";
import {
  LoggedUseCase,
  type Clock,
  type Logger,
  type UseCase,
} from "../../application/shared-kernel/index.js";

export interface AuditedWiringPorts {
  clock: Clock;
  logger: Logger;
  adminLog: AdminLog;
}

export interface AuditedWiring {
  /** A use case that logs its name, duration and outcome. */
  logged: <I, O>(operation: string, inner: UseCase<I, O>) => UseCase<I, O>;
  /** An administration use case: audited in the admin log, then logged. */
  admin: <I extends AdminRequest, O>(
    operation: string,
    inner: UseCase<I, O>,
    readers?: AuditedUseCaseReaders<I, O>,
  ) => UseCase<I, O>;
}

export function auditedWiring({ clock, logger, adminLog }: AuditedWiringPorts): AuditedWiring {
  const logged = <I, O>(operation: string, inner: UseCase<I, O>): UseCase<I, O> =>
    new LoggedUseCase(operation, inner, { clock, logger });
  return {
    logged,
    admin: (operation, inner, readers = {}) =>
      logged(operation, new AuditedUseCase(operation, inner, { log: adminLog, clock }, readers)),
  };
}
