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
  type Logger,
  type UseCase,
} from "../../application/shared-kernel/index.js";
import { pinoLogger } from "../../infrastructure/logging/pino-logger.js";
import { clockToleranceOf, systemClock } from "../../interface-adapters/shared-kernel/index.js";
import { bind, compositionModule, from, port, type Decorated } from "../graph/index.js";
import { PlatformConfigurationPort } from "../release.js";

export const ClockPort = port("kernel.clock")<Clock>();
export const LoggerPort = port("kernel.logger")<Logger>();
/** How far an instant a client declares may sit from the clock (level 1 of the configuration). */
export const ClockTolerancePort = port("kernel.tolerance")<ClockTolerance>();
/** Where what an operator does is written; whoever owns the log binds it (ADR-034). */
export const AuditTrailPort = port("kernel.audit-trail")<AuditTrail>();

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

export const kernelModule = compositionModule({
  provides: [
    bind(ClockPort, {}, () => systemClock),
    bind(LoggerPort, {}, () => pinoLogger()),
    bind(ClockTolerancePort, { platform: PlatformConfigurationPort }, ({ platform }) =>
      clockToleranceOf(platform.clockSkewToleranceMs, platform.eventPastToleranceMs),
    ),
  ],
  assembles: [
    bind(
      AuditPort,
      { clock: ClockPort, log: AuditTrailPort },
      ({ clock, log }) =>
        (operation, inner, readers = {}) =>
          new AuditedUseCase(operation, inner, { log, clock }, readers),
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
