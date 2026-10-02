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
  ListUnmappedAttributeValuesUseCase,
  ReportAnchorDiagnosticsUseCase,
  UnmappedValues,
  type AdminLog,
  type AnchorDiagnosticsStore,
  type SdkConfigurationSource,
  type UnmappedValueLog,
} from "../../application/admin/index.js";
import {
  makeGetSdkConfig,
  makeListAdminLog,
  makeListAnchorDiagnostics,
  makeListMerchantAdminLog,
  makeListUnmappedAttributeValues,
  makeReportAnchorDiagnostics,
  memoryAdminLog,
  memoryAnchorDiagnosticsStore,
  memoryUnmappedValueLog,
  sdkConfigurationOf,
  sqliteAdminLog,
  sqliteAnchorDiagnosticsStore,
  sqliteUnmappedValueLog,
} from "../../interface-adapters/admin/index.js";
import { bind, bindAll, compositionModule, served, port } from "../graph/index.js";
import { PlatformLevelPort, SqlStorePort } from "../release.js";
import { AttributeLabelReportPort } from "./catalog.js";
import { ConfigurationServicePort } from "./configuration.js";
import { ScopedMerchantPort } from "./merchant.js";
import { MessageDirectoryPort } from "./messages.js";
import { AuditTrailPort, ClockPort, LoggerPort } from "./shared-kernel.js";

export const AdminLogPort = port("admin.log")<AdminLog>();
const AnchorDiagnosticsPort = port("admin.diagnostics")<AnchorDiagnosticsStore>();
const UnmappedValuesPort = port("admin.unmapped-values")<UnmappedValueLog>();
/** What the SDK may see of the configuration of its merchant. */
const SdkConfigurationPort = port("admin.sdk-configuration")<SdkConfigurationSource>();

/**
 * What this module provides the same way whichever technology it is asked for: what the SDK may see of
 * the configuration of its merchant, which is a view over the resolution and keeps nothing of its own.
 *
 * Everything else here **does** differ, because everything else here holds state. And it is `provides`
 * and not `assembles` for the reason the configuration module writes in full: `providedPorts` is what a
 * test reset replaces, and a component that remembers has to be replaced.
 */
const whicheverTechnology = [
  bind(SdkConfigurationPort, { configuration: ConfigurationServicePort }, ({ configuration }) =>
    sdkConfigurationOf(configuration),
  ),
] as const;

/** How many of each the platform keeps per merchant: level 1 of the configuration, not a constant. */
const CAPS = { platform: PlatformLevelPort } as const;

export const adminModule = compositionModule({
  // One instance, two views of the log: what the administration reads and what every module writes
  // through the kernel's port (ADR-034). What the technology chooses is where the three land — the
  // record of what an operator did, and the two lists of what was observed of a merchant's traffic.
  provides: {
    memory: [
      ...whicheverTechnology,
      bindAll([AdminLogPort, AuditTrailPort], {}, () => memoryAdminLog()),
      bind(AnchorDiagnosticsPort, CAPS, ({ platform }) =>
        memoryAnchorDiagnosticsStore(() => platform.inForce().anchorDiagnosticsKept),
      ),
      bind(UnmappedValuesPort, CAPS, ({ platform }) =>
        memoryUnmappedValueLog(() => platform.inForce().unmappedValuesKept),
      ),
    ],
    sqlite: [
      ...whicheverTechnology,
      bindAll([AdminLogPort, AuditTrailPort], { store: SqlStorePort, logger: LoggerPort }, (deps) =>
        sqliteAdminLog(deps),
      ),
      bind(
        AnchorDiagnosticsPort,
        { ...CAPS, store: SqlStorePort, logger: LoggerPort },
        ({ platform, store, logger }) =>
          sqliteAnchorDiagnosticsStore({
            store,
            logger,
            kept: () => platform.inForce().anchorDiagnosticsKept,
          }),
      ),
      bind(
        UnmappedValuesPort,
        { ...CAPS, store: SqlStorePort, logger: LoggerPort },
        ({ platform, store, logger }) =>
          sqliteUnmappedValueLog({ store, logger, kept: () => platform.inForce().unmappedValuesKept }),
      ),
    ],
  },
  assembles: [
    bind(
      AttributeLabelReportPort,
      { log: UnmappedValuesPort, directory: MessageDirectoryPort },
      (deps) => new UnmappedValues(deps),
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
      listUnmappedAttributeValues: served(
        { scoped: ScopedMerchantPort, directory: MessageDirectoryPort, unmapped: UnmappedValuesPort },
        {
          name: "listUnmappedAttributeValues",
          build: (deps) => new ListUnmappedAttributeValuesUseCase(deps),
        },
        (useCase) => makeListUnmappedAttributeValues(useCase),
      ),
      listAnchorDiagnostics: served(
        { scoped: ScopedMerchantPort, diagnostics: AnchorDiagnosticsPort },
        { name: "listAnchorDiagnostics", build: (deps) => new ListAnchorDiagnosticsUseCase(deps) },
        (useCase) => makeListAnchorDiagnostics(useCase),
      ),
    },
  },
});
