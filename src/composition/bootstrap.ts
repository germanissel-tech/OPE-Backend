// Composition root (constitution I; ADR-013, ADR-033): here and only here a deployment is
// instantiated and what its modules serve is wired to the contract. Which deployment runs is a
// parameter (the local one by default; a test or a tool may pass another), never a branch on
// configuration; what has to be closed, and in which order, is what the graph created; which
// operations exist is what the modules serve, which the compiler already checked against the
// types of the contract and the boot checks again against the contract file it loads.
import { Operator } from "../domain/operator/index.js";
import { buildServer } from "../infrastructure/http/build-server.js";
import { ConfigError, type AppConfig } from "./config.js";
import { assertEveryOperationWired } from "./coverage.js";
import { localDeployment } from "./deployments/local.js";
import {
  instantiate,
  type Closable,
  type Deployment,
  type Instance,
  type Label,
  type Override,
} from "./graph/index.js";
import { ImportConfigurationLevelsPort, ImportConfigurationPort } from "./modules/configuration.js";
import { ImportExperimentsPort } from "./modules/experiment.js";
import { EventLogPort } from "./modules/ingestion.js";
import { ImportMerchantsPort } from "./modules/merchant.js";
import { LoggerPort } from "./modules/shared-kernel.js";
import { ContractPort, type SqlStorePort } from "./release.js";
import type { Handlers } from "../interface-adapters/http/typed.js";
import type { FastifyInstance } from "fastify";

/**
 * What a deployment has to provide for the boot to work: everything the local one provides, plus
 * the store a durable deployment adds.
 *
 * **Why the store is in the union although the local deployment has none.** `Deployment<P>` carries
 * `P` in a covariant position, so a deployment providing *more* is assignable to a `Deployment` of
 * *less* — never the other way round. That direction is the check that matters: a deployment that
 * provides **less** does not compile here, which is what keeps a module from being forgotten. But
 * it also means the type has to name the widest set, or the durable deployment would be rejected
 * for providing one component too many.
 *
 * The label is read off the port rather than written, so renaming the port cannot leave this
 * behind agreeing with nothing.
 */
export type DeployedComponents =
  (ReturnType<typeof localDeployment> extends Deployment<infer P> ? P : never) | Label<typeof SqlStorePort>;

export interface BootstrapOverrides {
  /** The deployment that builds the components; the local one unless a caller says otherwise. */
  deployment?: (config: AppConfig) => Deployment<DeployedComponents>;
  /** Targeted replacements the graph applies (for example, a fixed clock in tests). */
  ports?: readonly Override[];
  /** Handlers that replace the wired ones (negative contract tests). */
  handlers?: Handlers;
}

export interface App {
  app: FastifyInstance;
  /** The component behind a port, for whoever built the app (a test, a tool). */
  resolve: Instance<DeployedComponents>["resolve"];
  /** Shuts down the server, then what the graph created, in reverse creation order. */
  close: () => Promise<void>;
}

async function shutdown(app: FastifyInstance, closables: readonly Closable[]): Promise<void> {
  await app.close();
  for (const closable of [...closables].reverse()) await closable.close();
}

/**
 * The seed of the configuration enters an empty store through the same use cases as the API
 * (ADR-031): the merchants, then what each declares of its configuration as its version 1, then
 * its experiments; a store that already holds them keeps them. A seed the configuration accepted
 * and the entity rejects is a programming error; a declared value the resolution refuses stops the
 * start naming the field (constitution XI).
 */
export async function importSeed(
  config: AppConfig,
  graph: Pick<Instance<DeployedComponents>, "resolve">,
): Promise<void> {
  const actor = Operator.system();
  // **The two levels first, and the order is not incidental** (feature 036): from here on they live in the
  // store, and everything below —a merchant's declared configuration, its experiments— is judged against
  // them. A boot that imported the merchants first would judge them against a level that holds nothing.
  await importLevels(config, actor, graph);
  const seeds = config.merchants.map((m) => m.seed);
  const imported = await graph.resolve(ImportMerchantsPort).execute({ actor, seeds });
  if (!imported.ok) throw new Error(`The merchant seed was rejected: ${imported.error.code}.`);
  // **Both branches say something, and the second one is the point** (feature 033, SC-008). The seed is
  // imported only into an empty store and that has not changed; what had changed is that a store which
  // already holds merchants made this silent, so editing the file after the first boot did nothing and
  // said nothing. Now the log names the situation, and the way to change anything is the API.
  const logger = graph.resolve(LoggerPort);
  if ("imported" in imported.value) {
    logger.info({ merchants: imported.value.imported }, "merchant seed imported");
  } else {
    // Without a count, and on purpose: the use case answers `skipped` and nothing else, and counting the
    // merchants at boot just to put a number in a log line is work for a line. What the reader needs is
    // the reason, which is what was missing.
    logger.info(
      {},
      "merchant seed not applied: the store already holds merchants; change them through the administration API",
    );
  }
  // **The same silence the merchants had, and feature 033 gave it to two more stores.** The
  // configuration and the experiments of a merchant are now durable too, so from the second boot their
  // part of the seed is also kept rather than applied — and until this line existed, editing a declared
  // value in the file and restarting did nothing and said nothing. Said once at the end, because what a
  // reader needs is that the file stopped being the source, not one line per merchant.
  const kept = await importWhatEachMerchantDeclares(config, actor, graph);
  if (kept.configurations || kept.experiments) {
    logger.info(
      kept,
      "seed not applied to what the store already holds; change it through the administration API",
    );
  }
}

/**
 * The two levels of the release into an empty store (feature 036).
 *
 * **What this line ends is the deploy as the only way to change a platform rule or a treatment default.**
 * The files keep being the origin — of version 1, once — and from the second boot what is in force is what
 * an operator published. A boot that does not apply them says so, which is the half of **D-29** this closes:
 * until now the log reported an import that had not happened.
 */
async function importLevels(
  config: AppConfig,
  actor: Operator,
  graph: Pick<Instance<DeployedComponents>, "resolve">,
): Promise<void> {
  const imported = await graph.resolve(ImportConfigurationLevelsPort).execute({
    actor,
    // Spread and not handed over whole: a record of a named interface is not assignable to an index
    // signature, and an object literal built from one is — the seed is the file's content, key by key.
    contents: [
      { level: "platform", content: { ...config.levels.platform.record() } },
      { level: "defaults", content: { ...config.levels.defaults.record() } },
    ],
  });
  if (!imported.ok) throw new Error(`The configuration levels seed was rejected: ${imported.error.code}.`);
  const logger = graph.resolve(LoggerPort);
  if (imported.value.imported.length > 0) {
    logger.info({ levels: imported.value.imported }, "configuration levels seed imported");
  } else {
    logger.info(
      {},
      "configuration levels seed not applied: the store already holds both levels; change them through the administration API",
    );
  }
}

/** The branch a use case of the seed answers when the store already held what the file brings. */
const SKIPPED = "skipped";

/** What of each merchant's own seed was kept rather than applied, for the line `importSeed` writes. */
async function importWhatEachMerchantDeclares(
  config: AppConfig,
  actor: Operator,
  graph: Pick<Instance<DeployedComponents>, "resolve">,
): Promise<{ configurations: boolean; experiments: boolean }> {
  const importConfiguration = graph.resolve(ImportConfigurationPort);
  const importExperiments = graph.resolve(ImportExperimentsPort);
  const kept = { configurations: false, experiments: false };
  for (const [i, merchant] of config.merchants.entries()) {
    if (Object.keys(merchant.declared).length > 0) {
      const configured = await importConfiguration.execute({
        actor,
        merchantId: merchant.merchantId,
        declared: merchant.declared,
      });
      if (!configured.ok) {
        const { pointer, problem } = configured.error.details;
        throw new ConfigError(`merchants[${i}].${String(pointer)}`, `is invalid (${String(problem)})`);
      }
      if (SKIPPED in configured.value) kept.configurations = true;
    }
    const experiments = merchant.experiments.all();
    if (experiments.length === 0) continue;
    const opened = await importExperiments.execute({ actor, merchantId: merchant.merchantId, experiments });
    if (!opened.ok) throw new Error(`The experiment seed was rejected: ${opened.error.code}.`);
    if (SKIPPED in opened.value) kept.experiments = true;
  }
  return kept;
}

/**
 * Says what the previous run lost, if it lost anything (feature 031, FR-018).
 *
 * **Here and not anywhere else, because here nothing is queued yet.** The register is written from a
 * queue, so while the process runs a decision without its events may simply be a write on its way;
 * at start-up it can only be a batch that arrived and was never written, which is what a process
 * killed without an orderly shutdown leaves behind.
 *
 * It is a log line and not a refusal to start: a hole in the measurement does not make the server
 * unable to serve, and hiding it would be the opposite of what the register promises — it does not
 * promise completeness, it promises to know where it does not have it (Q3).
 */
async function reportWhatWasLost(graph: Pick<Instance<DeployedComponents>, "resolve">): Promise<void> {
  const hole = await graph.resolve(EventLogPort).unrecorded();
  if (hole === undefined) return;
  graph.resolve(LoggerPort).error(
    {
      events: hole.events,
      batches: hole.batches,
      from: hole.from.toISOString(),
      to: hole.to.toISOString(),
    },
    "The event register is missing what a previous run held when it stopped without draining.",
  );
}

export async function bootstrap(config: AppConfig, overrides: BootstrapOverrides = {}): Promise<App> {
  const graph = instantiate((overrides.deployment ?? localDeployment)(config), overrides.ports ?? []);
  // Builds everything the deployment binds: a cycle is found here, and what is created is
  // created in the order of the list, which is the order the shutdown reverses.
  graph.resolveAll();
  try {
    const definition = graph.resolve(ContractPort);
    await importSeed(config, graph);
    await reportWhatWasLost(graph);
    const wired = graph.wire();
    const handlers: Handlers = { ...wired.handlers, ...overrides.handlers };
    assertEveryOperationWired(definition, handlers);
    const app = await buildServer({
      definition,
      handlers,
      security: wired.security,
      cors: wired.cors,
      logger: graph.resolve(LoggerPort),
      retryAfterSeconds: config.levels.platform.retryAfterSeconds,
    });
    return { app, resolve: graph.resolve, close: () => shutdown(app, graph.closables) };
  } catch (failure) {
    // **A boot that fails after building the graph closes what it built.** The graph creates the store
    // before the seed runs, and a seed that is refused —which is what an unauditable platform looks
    // like— used to leave the file open with nobody holding the handle. In production the process exits
    // and nothing notices; a test that boots, fails and then tries to delete its directory does, and on
    // Windows it cannot. Closing is the honest half of "failing loudly" (feature 034).
    for (const closable of [...graph.closables].reverse()) await closable.close();
    throw failure;
  }
}
