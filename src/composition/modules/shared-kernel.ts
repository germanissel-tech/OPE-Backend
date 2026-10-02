// shared-kernel: what every module may need. The clock, the logger and the tolerance of declared
// instants, plus the decoration the platform applies to every use case it serves (ADR-023,
// ADR-034, feature 021): the operational log, and the audit trail of what an operator did.
//
// Nobody asks for the decoration and nobody chooses it: the kernel declares it once for the
// deployment and the contract says which operations are audited.
//
// The audit trail is declared here and bound by whoever owns the log (the administration): that is
// what lets any module audit without depending on the module that stores the record.
import {
  AuditedUseCase,
  LoggedUseCase,
  type AdminRequest,
  type AuditTrail,
  type AuditedUseCaseReaders,
  type Clock,
  type ClockTolerance,
  type UnitOfWork,
  type Logger,
  type UseCase,
} from "../../application/shared-kernel/index.js";
import { pinoLogger } from "../../infrastructure/logging/pino-logger.js";
import {
  clockToleranceOf,
  durableUnitOfWork,
  systemClock,
  transientUnitOfWork,
} from "../../interface-adapters/shared-kernel/index.js";
import { bind, compositionModule, from, port, type Decorated } from "../graph/index.js";
import { PlatformLevelPort, SqlStorePort } from "../release.js";

export const ClockPort = port("kernel.clock")<Clock>();
export const LoggerPort = port("kernel.logger")<Logger>();
/** How far an instant a client declares may sit from the clock (level 1 of the configuration). */
export const ClockTolerancePort = port("kernel.tolerance")<ClockTolerance>();
/** Where what an operator does is written; whoever owns the log binds it (ADR-034). */
export const AuditTrailPort = port("kernel.audit-trail")<AuditTrail>();
/**
 * What makes several writes one fact (feature 034): the deployment chooses which one it has.
 *
 * Not exported, unlike the trail beside it: nobody outside this module binds it or replaces it — the
 * kernel provides both implementations and the only consumer is the decorator it assembles here.
 */
const UnitOfWorkPort = port("kernel.unit-of-work")<UnitOfWork>();

/**
 * Wrapping a use case with its administration entry and nothing else. What the server serves
 * never asks for this —there the decoration decides, reading the contract— but the seed of the
 * boot does: what it imports is audited as the system operator and is not an execution the
 * operational log reports.
 */
export type Audit = <I extends AdminRequest, O>(
  operation: string,
  inner: UseCase<I, O>,
  readers?: AuditedUseCaseReaders<I, O>,
) => UseCase<I, O>;
export const AuditPort = port("kernel.audit")<Audit>();

/** What the kernel is in every deployment: the clock, the log and the tolerance of a declared instant. */
const whicheverTechnology = [
  bind(ClockPort, {}, () => systemClock),
  bind(LoggerPort, {}, () => pinoLogger()),
  bind(ClockTolerancePort, { platform: PlatformLevelPort }, ({ platform }) =>
    clockToleranceOf(
      () => platform.inForce().clockSkewToleranceMs,
      () => platform.inForce().eventPastToleranceMs,
    ),
  ),
] as const;

export const kernelModule = compositionModule({
  // **The kernel gained a technology with feature 034**, and it is the unit of work: over a durable store
  // it is that store's transaction, and over a deployment that keeps nothing in common there is nothing to
  // compose. The port is the kernel's because any module may have to promise that two things happened
  // together; which of the two implementations answers is the deployment's decision (ADR-033).
  provides: {
    memory: [...whicheverTechnology, bind(UnitOfWorkPort, {}, () => transientUnitOfWork())],
    sqlite: [
      ...whicheverTechnology,
      bind(UnitOfWorkPort, { store: SqlStorePort }, ({ store }) => durableUnitOfWork(store)),
    ],
  },
  assembles: [
    bind(
      AuditPort,
      { clock: ClockPort, log: AuditTrailPort, unit: UnitOfWorkPort },
      ({ clock, log, unit }) =>
        (operation, inner, readers = {}) =>
          new AuditedUseCase(operation, inner, { log, clock, unit }, readers),
    ),
  ],
  serves: {
    // What wraps every use case the server runs. The kernel owns it because the clock, the logger
    // and the audit trail are its components; no handler asks for it and no handler chooses,
    // because whether an operation is audited is what the contract says (feature 021).
    decoration: from(
      { clock: ClockPort, logger: LoggerPort, audit: AuditPort },
      ({ clock, logger, audit }) => ({
        wrap: <I, O>(useCase: UseCase<I, O>, how: Decorated<I, O>): UseCase<I, O> => {
          // The audit goes inside: what the operational log measures is the whole administration
          // action, the entry included, which is what it measured before.
          //
          // `I extends AdminRequest` is what the audited slot of `Serves` already demanded, so a
          // use case reaching here with `how.audited` does carry an operator; the compiler cannot
          // see it because `wrap` is generic over every operation at once.
          const inner: UseCase<I, O> = how.audited
            ? audit<I & AdminRequest, O>(how.operation, useCase, how.readers)
            : useCase;
          return new LoggedUseCase(how.name, inner, { clock, logger });
        },
      }),
    ),
  },
});
