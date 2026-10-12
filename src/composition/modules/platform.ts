// platform module (feature 044, ADR-047): how OPE reads a merchant's platform. It installs the sources this
// deployment has, keeps where each flow stands and runs the scheduler of `pull`, which deposits through the
// same four use cases the `push` enters by — built here a second time, each behind the mode gate with `pull`,
// over the same stores, so what the scheduler brings is what a `push` would have brought.
//
// The configuration reads two things of it and binds a third: the sources it installed (to refuse a mode
// nothing executes), and binds what the scheduler reads of each merchant (`PlatformPoliciesPort`).
import {
  RefreshStockAndPriceUseCase,
  UpsertCatalogSnapshotUseCase,
} from "../../application/catalog/index.js";
import { NotifyOrderUseCase, NotifyReturnUseCase } from "../../application/outcomes/index.js";
import {
  GetPlatformSyncUseCase,
  type PlatformPolicies,
  type SyncStateStore,
} from "../../application/platform/index.js";
import {
  ModeGatedUseCase,
  type SyncStrategies,
  type UseCase,
} from "../../application/shared-kernel/index.js";
import {
  fileTestSource,
  installedSources,
  makeGetMerchantPlatformSync,
  memorySyncStateStore,
  platformScheduler,
  schedulerTimer,
  scriptedTestSource,
  sqliteSyncStateStore,
  type InstalledSources,
  type PlatformScheduler,
  type SchedulerTimer,
} from "../../interface-adapters/platform/index.js";
import { bind, compositionModule, port, served } from "../graph/index.js";
import { PlatformLevelPort, SqlStorePort, TestPlatformFilesPort } from "../release.js";
import { AttributeLabelReportPort, CatalogPoliciesPort, CatalogStorePort } from "./catalog.js";
import { DecisionLedgerPort } from "./ledger.js";
import { MerchantStorePort, ScopedMerchantPort } from "./merchant.js";
import { CorroborationLedgerPort, OrderLedgerPort } from "./outcomes.js";
import { ClockPort, ClockTolerancePort, LoggerPort, SyncStrategiesPort } from "./shared-kernel.js";
import type { MerchantId, SyncFlow } from "../../domain/shared-kernel/index.js";

/** The sources this deployment installed; the configuration asks it before it publishes a mode. */
export const InstalledSourcesPort = port("platform.sources")<InstalledSources>();
/** What the scheduler reads of each merchant; the configuration binds it. */
export const PlatformPoliciesPort = port("platform.policies")<PlatformPolicies>();
const SyncStateStorePort = port("platform.sync-states")<SyncStateStore>();
/** The scheduler itself, which a test runs with its own clock instead of waiting for the timer. */
export const PlatformSchedulerPort = port("platform.scheduler")<PlatformScheduler>();
/** The timer that runs it: the boot starts it once the levels are read, and the graph closes it. */
export const SchedulerTimerPort = port("platform.timer")<SchedulerTimer>();

/** The entrance by `pull`: the same gate the `push` has, with the other word (research R-08). */
const pulled = <I extends { merchantId: MerchantId }, O>(
  inner: UseCase<I, O>,
  strategies: SyncStrategies,
  flow: SyncFlow,
) => new ModeGatedUseCase(inner, { strategies }, { flow, mode: "pull" });

export const platformModule = compositionModule({
  provides: {
    // The local deployment always has the test platform (research R-09); a test that scripts it replaces this
    // component with one over its own `scriptedTestSource()`.
    memory: [
      bind(InstalledSourcesPort, {}, () => installedSources(new Map([["test", scriptedTestSource()]]))),
      bind(SyncStateStorePort, {}, () => memorySyncStateStore()),
    ],
    // The durable one has it only when `OPE_TEST_PLATFORM` names its file: without it, it does not exist, and
    // the configuration refuses a merchant that names it. A list of none or one, so nothing here decides.
    sqlite: [
      bind(InstalledSourcesPort, { files: TestPlatformFilesPort }, ({ files }) =>
        installedSources(new Map(files.map((file) => ["test", fileTestSource(file)] as const))),
      ),
      bind(SyncStateStorePort, { store: SqlStorePort, logger: LoggerPort }, (deps) =>
        sqliteSyncStateStore(deps),
      ),
    ],
  },
  assembles: [
    bind(
      PlatformSchedulerPort,
      {
        clock: ClockPort,
        tolerance: ClockTolerancePort,
        logger: LoggerPort,
        merchants: MerchantStorePort,
        policies: PlatformPoliciesPort,
        states: SyncStateStorePort,
        sources: InstalledSourcesPort,
        strategies: SyncStrategiesPort,
        catalog: CatalogStorePort,
        catalogPolicies: CatalogPoliciesPort,
        labels: AttributeLabelReportPort,
        orders: OrderLedgerPort,
        decisions: DecisionLedgerPort,
        corroborations: CorroborationLedgerPort,
      },
      (deps) => {
        const { clock, tolerance, logger, strategies, catalog } = deps;
        const store = { clock, tolerance, logger, store: catalog, policies: deps.catalogPolicies };
        const outcomes = { clock, tolerance, logger, orders: deps.orders };
        return platformScheduler({
          merchants: deps.merchants,
          policies: deps.policies,
          states: deps.states,
          sources: deps.sources,
          catalog,
          logger,
          upsertCatalog: pulled(
            new UpsertCatalogSnapshotUseCase({ ...store, labels: deps.labels }),
            strategies,
            "catalog",
          ),
          refreshStockAndPrice: pulled(new RefreshStockAndPriceUseCase(store), strategies, "stockAndPrice"),
          notifyOrder: pulled(
            new NotifyOrderUseCase({
              ...outcomes,
              decisions: deps.decisions,
              corroborations: deps.corroborations,
            }),
            strategies,
            "orders",
          ),
          notifyReturn: pulled(new NotifyReturnUseCase(outcomes), strategies, "returns"),
        });
      },
    ),
    bind(
      SchedulerTimerPort,
      { scheduler: PlatformSchedulerPort, clock: ClockPort, logger: LoggerPort, platform: PlatformLevelPort },
      ({ platform, ...deps }) =>
        schedulerTimer({ ...deps, tickMs: () => platform.inForce().platformSyncTickMs }),
    ),
  ],
  serves: {
    handlers: {
      getMerchantPlatformSync: served(
        { scoped: ScopedMerchantPort, policies: PlatformPoliciesPort, states: SyncStateStorePort },
        { name: "getMerchantPlatformSync", build: (deps) => new GetPlatformSyncUseCase(deps) },
        (useCase) => makeGetMerchantPlatformSync(useCase),
      ),
    },
  },
});
