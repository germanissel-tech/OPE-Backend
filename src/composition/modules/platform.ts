// platform module (feature 044, ADR-047): how OPE reads a merchant's platform. It installs the sources this
// deployment has, keeps where each flow stands and the notices waiting to be read, and runs the scheduler of
// `pull` and the reading of `subscribe`. Both deposit through the same use cases the `push` enters by — built here
// again, behind the mode gate with their own word, over the same stores — so what is read is what a `push` would
// have brought.
//
// The configuration reads two things of it and binds a third: the sources it installed (to refuse a mode
// nothing executes), and binds what the scheduler reads of each merchant (`PlatformPoliciesPort`).
import {
  RefreshStockAndPriceUseCase,
  UpsertCatalogSnapshotUseCase,
} from "../../application/catalog/index.js";
import { NotifyOrderUseCase, NotifyReturnUseCase } from "../../application/outcomes/index.js";
import {
  AcceptNoticeUseCase,
  GetPlatformSyncUseCase,
  type NoticeQueue,
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
  makeNotifyPlatformChange,
  memoryNoticeQueue,
  memorySyncStateStore,
  noticeReader,
  platformScheduler,
  schedulerTimer,
  scriptedTestSource,
  sqliteNoticeQueue,
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
import type { MerchantId, SyncFlow, SyncMode } from "../../domain/shared-kernel/index.js";

/** The sources this deployment installed; the configuration asks it before it publishes a mode. */
export const InstalledSourcesPort = port("platform.sources")<InstalledSources>();
/** What the scheduler reads of each merchant; the configuration binds it. */
export const PlatformPoliciesPort = port("platform.policies")<PlatformPolicies>();
const SyncStateStorePort = port("platform.sync-states")<SyncStateStore>();
const NoticeQueuePort = port("platform.notices")<NoticeQueue>();
/** The scheduler itself, which a test runs with its own clock instead of waiting for the timer. */
export const PlatformSchedulerPort = port("platform.scheduler")<PlatformScheduler>();
/** The timer that runs it: the boot starts it once the levels are read, and the graph closes it. */
export const SchedulerTimerPort = port("platform.timer")<SchedulerTimer>();

/** An entrance by a mode that is not `push`: the same gate the `push` has, with the other word (research R-08). */
const gated = <I extends { merchantId: MerchantId }, O>(
  inner: UseCase<I, O>,
  strategies: SyncStrategies,
  flow: SyncFlow,
  mode: SyncMode,
) => new ModeGatedUseCase(inner, { strategies }, { flow, mode });

export const platformModule = compositionModule({
  provides: {
    // The local deployment always has the test platform (research R-09); a test that scripts it replaces this
    // component with one over its own `scriptedTestSource()`.
    memory: [
      bind(InstalledSourcesPort, {}, () => installedSources(new Map([["test", scriptedTestSource()]]))),
      bind(SyncStateStorePort, {}, () => memorySyncStateStore()),
      bind(NoticeQueuePort, {}, () => memoryNoticeQueue()),
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
      bind(NoticeQueuePort, { store: SqlStorePort, logger: LoggerPort }, (deps) => sqliteNoticeQueue(deps)),
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
        notices: NoticeQueuePort,
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
        const notifyOrder = new NotifyOrderUseCase({
          ...outcomes,
          decisions: deps.decisions,
          corroborations: deps.corroborations,
        });
        const notifyReturn = new NotifyReturnUseCase(outcomes);
        const { policies, states, sources } = deps;
        return platformScheduler({
          merchants: deps.merchants,
          policies,
          states,
          sources,
          catalog,
          logger,
          upsertCatalog: gated(
            new UpsertCatalogSnapshotUseCase({ ...store, labels: deps.labels }),
            strategies,
            "catalog",
            "pull",
          ),
          refreshStockAndPrice: gated(
            new RefreshStockAndPriceUseCase(store),
            strategies,
            "stockAndPrice",
            "pull",
          ),
          notifyOrder: gated(notifyOrder, strategies, "orders", "pull"),
          notifyReturn: gated(notifyReturn, strategies, "returns", "pull"),
          notices: noticeReader({
            notices: deps.notices,
            policies,
            states,
            sources,
            logger,
            notifyOrder: gated(notifyOrder, strategies, "orders", "subscribe"),
            notifyReturn: gated(notifyReturn, strategies, "returns", "subscribe"),
          }),
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
      notifyPlatformChange: served(
        { clock: ClockPort, queue: NoticeQueuePort, strategies: SyncStrategiesPort },
        {
          name: "notifyPlatformChange",
          // The flow is the one the notice names, and the gate reads it from the request.
          build: ({ strategies, ...deps }) =>
            new ModeGatedUseCase(
              new AcceptNoticeUseCase(deps),
              { strategies },
              { flow: (request) => request.flow, mode: "subscribe" },
            ),
        },
        (useCase) => makeNotifyPlatformChange(useCase),
      ),
      getMerchantPlatformSync: served(
        {
          scoped: ScopedMerchantPort,
          policies: PlatformPoliciesPort,
          states: SyncStateStorePort,
          notices: NoticeQueuePort,
        },
        { name: "getMerchantPlatformSync", build: (deps) => new GetPlatformSyncUseCase(deps) },
        (useCase) => makeGetMerchantPlatformSync(useCase),
      ),
    },
  },
});
