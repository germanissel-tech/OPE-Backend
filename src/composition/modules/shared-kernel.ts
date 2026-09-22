// shared-kernel: what every module may need. The clock, the logger and the tolerance of declared
// instants, plus the two decorators the platform applies to every use case it serves (ADR-023,
// ADR-034): the operational log, and the audit trail of what an operator did.
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
import { bind, compositionModule, port, technology } from "../graph/index.js";
import { PlatformConfigurationPort } from "../release.js";

/** What the composition wraps a use case with. The name of the log is the name of the use case. */
export interface UseCaseDecorators {
  logged: <I, O>(useCase: string, inner: UseCase<I, O>) => UseCase<I, O>;
  /**
   * What an operator did, written to the audit trail whether it was accepted, rejected or denied.
   * On its own it does not log: what enters at boot (the seed) is audited and not an execution the
   * operational log reports.
   */
  audited: <I extends AdminRequest, O>(
    operation: string,
    inner: UseCase<I, O>,
    readers?: AuditedUseCaseReaders<I, O>,
  ) => UseCase<I, O>;
  /** An administration operation the server serves: audited under its `operationId`, then logged. */
  administered: <I extends AdminRequest, O>(
    operation: string,
    inner: UseCase<I, O>,
    readers?: AuditedUseCaseReaders<I, O>,
  ) => UseCase<I, O>;
}

export const ClockPort = port("kernel.clock")<Clock>();
export const LoggerPort = port("kernel.logger")<Logger>();
/** How far an instant a client declares may sit from the clock (level 1 of the configuration). */
export const ClockTolerancePort = port("kernel.tolerance")<ClockTolerance>();
/** Where what an operator does is written; whoever owns the log binds it (ADR-034). */
export const AuditTrailPort = port("kernel.audit-trail")<AuditTrail>();
export const DecoratorsPort = port("kernel.decorators")<UseCaseDecorators>();

const PORTS = [ClockPort, LoggerPort, ClockTolerancePort] as const;

export const kernelModule = compositionModule({
  ports: PORTS,
  technologies: {
    /** The system clock and pino to stdout; tests replace both by port. */
    system: technology(PORTS, [
      bind(ClockPort, {}, () => systemClock),
      bind(LoggerPort, {}, () => pinoLogger()),
      bind(ClockTolerancePort, { platform: PlatformConfigurationPort }, ({ platform }) =>
        clockToleranceOf(platform.clockSkewToleranceMs, platform.eventPastToleranceMs),
      ),
    ]),
  },
  exposes: [
    bind(
      DecoratorsPort,
      { clock: ClockPort, logger: LoggerPort, log: AuditTrailPort },
      ({ clock, logger, log }) => {
        const logged = <I, O>(useCase: string, inner: UseCase<I, O>): UseCase<I, O> =>
          new LoggedUseCase(useCase, inner, { clock, logger });
        const audited = <I extends AdminRequest, O>(
          operation: string,
          inner: UseCase<I, O>,
          readers: AuditedUseCaseReaders<I, O> = {},
        ): UseCase<I, O> => new AuditedUseCase(operation, inner, { log, clock }, readers);
        return {
          logged,
          audited,
          administered: (operation, inner, readers) => logged(operation, audited(operation, inner, readers)),
        };
      },
    ),
  ],
});
