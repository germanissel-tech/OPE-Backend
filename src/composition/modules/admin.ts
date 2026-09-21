// Admin module (ADR-031): the operators of OPE, the admin log and the anchor diagnostics. It
// wires the `adminToken` security scheme the way merchant wires the credentials of the SDK and
// the platform, serves the operations that are of the platform rather than of one merchant, and
// what the SDK reads and reports of its merchant (01 §3.1.1): its configuration and the anchors
// that stopped resolving.
import {
  DefaultAdminTokenResolver,
  GetSdkConfigUseCase,
  ListAdminLogUseCase,
  ListAnchorDiagnosticsUseCase,
  ListMerchantAdminLogUseCase,
  ReportAnchorDiagnosticsUseCase,
  type AdminLog,
  type AnchorDiagnosticsStore,
  type OperatorDirectory,
  type SdkConfigurationSource,
  type TokenFingerprinter,
} from "../../application/admin/index.js";
import { DefaultScopedMerchantService, type MerchantStore } from "../../application/merchant/index.js";
import {
  LoggedUseCase,
  type Clock,
  type Logger,
  type UseCase,
} from "../../application/shared-kernel/index.js";
import {
  configOperatorDirectory,
  memoryAdminLog,
  memoryAnchorDiagnosticsStore,
  nodeTokenFingerprinter,
  makeGetSdkConfig,
  makeListAdminLog,
  makeListAnchorDiagnostics,
  makeListMerchantAdminLog,
  makeReportAnchorDiagnostics,
  ADMIN_TOKEN_HEADER,
  ADMIN_TOKEN_SCHEME,
  makeAdminTokenSecurity,
} from "../../interface-adapters/admin/index.js";
import { sdkConfigurationOf } from "./configuration.js";
import type { ConfigurationService } from "../../application/configuration/index.js";
import type { PlatformConfiguration } from "../../domain/configuration/index.js";
import type { Operator } from "../../domain/operator/index.js";
import type { Bindings, Module } from "../wiring.js";

export interface AdminPorts {
  clock: Clock;
  logger: Logger;
  operators: OperatorDirectory;
  fingerprints: TokenFingerprinter;
  adminLog: AdminLog;
  diagnostics: AnchorDiagnosticsStore;
  /** What the SDK may see of the configuration of its merchant. */
  sdkConfiguration: SdkConfigurationSource;
  merchantStore: MerchantStore;
}

/** Operators as the configuration lists them; fingerprints with Node's crypto. */
export const configAdminPorts = (
  operators: readonly Operator[],
): Bindings<Pick<AdminPorts, "operators" | "fingerprints">> => ({
  operators: () => configOperatorDirectory(operators),
  fingerprints: () => nodeTokenFingerprinter,
});

/** The log and the diagnostics in memory; how many diagnostics are kept is the platform's (level 1). */
export const memoryAdminPorts = (
  platform: PlatformConfiguration,
): Bindings<Pick<AdminPorts, "adminLog" | "diagnostics">> => ({
  adminLog: memoryAdminLog,
  diagnostics: () => memoryAnchorDiagnosticsStore(platform.anchorDiagnosticsKept),
});

/** The SDK view of the configuration, from the resolution the configuration module serves. */
export const configuredAdminPorts = (
  configuration: () => ConfigurationService,
): Bindings<Pick<AdminPorts, "sdkConfiguration">> => ({
  sdkConfiguration: () => sdkConfigurationOf(configuration()),
});

export const adminModule: Module<AdminPorts> = ({ ports }) => {
  const { clock, logger, adminLog, diagnostics } = ports;
  const logged = <I, O>(operation: string, inner: UseCase<I, O>): UseCase<I, O> =>
    new LoggedUseCase(operation, inner, { clock, logger });
  const scoped = new DefaultScopedMerchantService({ merchants: ports.merchantStore });
  const resolver = new DefaultAdminTokenResolver({
    operators: ports.operators,
    fingerprints: ports.fingerprints,
  });
  const listAdminLog = new LoggedUseCase("listAdminLog", new ListAdminLogUseCase({ log: adminLog }), {
    clock,
    logger,
  });
  return {
    security: {
      [ADMIN_TOKEN_SCHEME]: {
        handler: makeAdminTokenSecurity(resolver),
        header: ADMIN_TOKEN_HEADER,
        consumer: "server",
      },
    },
    handlers: {
      listAdminLog: makeListAdminLog(listAdminLog),
      listMerchantAdminLog: makeListMerchantAdminLog(
        new LoggedUseCase("listMerchantAdminLog", new ListMerchantAdminLogUseCase({ log: adminLog }), {
          clock,
          logger,
        }),
      ),
      getSdkConfig: makeGetSdkConfig(
        logged("getSdkConfig", new GetSdkConfigUseCase({ configuration: ports.sdkConfiguration })),
      ),
      reportAnchorDiagnostics: makeReportAnchorDiagnostics(
        logged("reportAnchorDiagnostics", new ReportAnchorDiagnosticsUseCase({ diagnostics, clock })),
      ),
      listAnchorDiagnostics: makeListAnchorDiagnostics(
        logged("listAnchorDiagnostics", new ListAnchorDiagnosticsUseCase({ scoped, diagnostics })),
      ),
    },
  };
};
