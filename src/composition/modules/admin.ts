// Admin module (ADR-031, ADR-034): the operators of OPE, the record of what they do and the
// anchor diagnostics. It owns the log —one instance behind two views: the reads of the
// administration and the write port of the kernel every module audits through— and serves what
// the SDK reads and reports of its merchant (01 §3.1.1): its configuration and the anchors that
// stopped resolving.
import {
  GetSdkConfigUseCase,
  ListAdminLogUseCase,
  ListAnchorDiagnosticsUseCase,
  ListMerchantAdminLogUseCase,
  ReportAnchorDiagnosticsUseCase,
  type AdminLog,
  type AnchorDiagnosticsStore,
  type SdkConfigurationSource,
} from "../../application/admin/index.js";
import {
  makeGetSdkConfig,
  makeListAdminLog,
  makeListAnchorDiagnostics,
  makeListMerchantAdminLog,
  makeReportAnchorDiagnostics,
  memoryAdminLog,
  memoryAnchorDiagnosticsStore,
  sdkConfigurationOf,
} from "../../interface-adapters/admin/index.js";
import { bind, bindAll, compositionModule, served, port } from "../graph/index.js";
import { PlatformConfigurationPort } from "../release.js";
import { ConfigurationServicePort } from "./configuration.js";
import { ScopedMerchantPort } from "./merchant.js";
import { AuditTrailPort, ClockPort } from "./shared-kernel.js";

export const AdminLogPort = port("admin.log")<AdminLog>();
const AnchorDiagnosticsPort = port("admin.diagnostics")<AnchorDiagnosticsStore>();
/** What the SDK may see of the configuration of its merchant. */
const SdkConfigurationPort = port("admin.sdk-configuration")<SdkConfigurationSource>();

export const adminModule = compositionModule({
  provides: [
    // One instance, two views: what the administration reads and what every module writes
    // through the kernel's port (ADR-034).
    bindAll([AdminLogPort, AuditTrailPort], {}, () => memoryAdminLog()),
    bind(AnchorDiagnosticsPort, { platform: PlatformConfigurationPort }, ({ platform }) =>
      memoryAnchorDiagnosticsStore(platform.anchorDiagnosticsKept),
    ),
    bind(SdkConfigurationPort, { configuration: ConfigurationServicePort }, ({ configuration }) =>
      sdkConfigurationOf(configuration),
    ),
  ],
  serves: {
    handlers: {
      listAdminLog: served(
        { log: AdminLogPort },
        { name: "listAdminLog", build: (deps) => new ListAdminLogUseCase(deps) },
        (useCase) => makeListAdminLog(useCase),
      ),
      listMerchantAdminLog: served(
        { log: AdminLogPort },
        { name: "listMerchantAdminLog", build: (deps) => new ListMerchantAdminLogUseCase(deps) },
        (useCase) => makeListMerchantAdminLog(useCase),
      ),
      getSdkConfig: served(
        { configuration: SdkConfigurationPort },
        { name: "getSdkConfig", build: (deps) => new GetSdkConfigUseCase(deps) },
        (useCase) => makeGetSdkConfig(useCase),
      ),
      reportAnchorDiagnostics: served(
        { diagnostics: AnchorDiagnosticsPort, clock: ClockPort },
        { name: "reportAnchorDiagnostics", build: (deps) => new ReportAnchorDiagnosticsUseCase(deps) },
        (useCase) => makeReportAnchorDiagnostics(useCase),
      ),
      listAnchorDiagnostics: served(
        { scoped: ScopedMerchantPort, diagnostics: AnchorDiagnosticsPort },
        { name: "listAnchorDiagnostics", build: (deps) => new ListAnchorDiagnosticsUseCase(deps) },
        (useCase) => makeListAnchorDiagnostics(useCase),
      ),
    },
  },
});
