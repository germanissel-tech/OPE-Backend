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
import { instantiate, type Closable, type Deployment, type Instance, type Override } from "./graph/index.js";
import { ImportConfigurationPort } from "./modules/configuration.js";
import { ImportExperimentsPort } from "./modules/experiment.js";
import { ImportMerchantsPort } from "./modules/merchant.js";
import { LoggerPort } from "./modules/shared-kernel.js";
import { ContractPort } from "./release.js";
import type { Handlers } from "../interface-adapters/http/typed.js";
import type { FastifyInstance } from "fastify";

/** What the local deployment provides; a deployment that provides less does not compile here. */
export type LocalComponents = ReturnType<typeof localDeployment> extends Deployment<infer P> ? P : never;

export interface BootstrapOverrides {
  /** The deployment that builds the components; the local one unless a caller says otherwise. */
  deployment?: (config: AppConfig) => Deployment<LocalComponents>;
  /** Targeted replacements the graph applies (for example, a fixed clock in tests). */
  ports?: readonly Override[];
  /** Handlers that replace the wired ones (negative contract tests). */
  handlers?: Handlers;
}

export interface App {
  app: FastifyInstance;
  /** The component behind a port, for whoever built the app (a test, a tool). */
  resolve: Instance<LocalComponents>["resolve"];
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
  graph: Pick<Instance<LocalComponents>, "resolve">,
): Promise<void> {
  const actor = Operator.system();
  const seeds = config.merchants.map((m) => m.seed);
  const imported = await graph.resolve(ImportMerchantsPort).execute({ actor, seeds });
  if (!imported.ok) throw new Error(`The merchant seed was rejected: ${imported.error.code}.`);
  if ("imported" in imported.value && imported.value.imported > 0) {
    graph.resolve(LoggerPort).info({ merchants: imported.value.imported }, "merchant seed imported");
  }
  const importConfiguration = graph.resolve(ImportConfigurationPort);
  const importExperiments = graph.resolve(ImportExperimentsPort);
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
    }
    const experiments = merchant.experiments.all();
    if (experiments.length === 0) continue;
    const opened = await importExperiments.execute({ actor, merchantId: merchant.merchantId, experiments });
    if (!opened.ok) throw new Error(`The experiment seed was rejected: ${opened.error.code}.`);
  }
}

export async function bootstrap(config: AppConfig, overrides: BootstrapOverrides = {}): Promise<App> {
  const graph = instantiate((overrides.deployment ?? localDeployment)(config), overrides.ports ?? []);
  // Builds everything the deployment binds: a cycle is found here, and what is created is
  // created in the order of the list, which is the order the shutdown reverses.
  graph.resolveAll();
  const definition = graph.resolve(ContractPort);
  await importSeed(config, graph);
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
}
