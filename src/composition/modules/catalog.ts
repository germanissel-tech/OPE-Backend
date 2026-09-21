// catalog module (ADR-025): the merchant's catalogue snapshot, what it needs (`CatalogPorts`),
// how memory serves it (`memoryCatalogPorts`) and what it serves (`upsertCatalogSnapshot`).
// The product-truth service is built here for whoever decides (feature 011).
import {
  DefaultProductTruthService,
  UpsertCatalogSnapshotUseCase,
  type CatalogPolicies,
  type CatalogStore,
  type ProductTruthService,
} from "../../application/catalog/index.js";
import {
  LoggedUseCase,
  type Clock,
  type ClockTolerance,
  type Logger,
} from "../../application/shared-kernel/index.js";
import { memoryCatalogStore, makeUpsertCatalogSnapshot } from "../../interface-adapters/catalog/index.js";
import { catalogPoliciesOf } from "./configuration.js";
import type { ConfigurationService } from "../../application/configuration/index.js";
import type { Bindings, Module } from "../wiring.js";

export interface CatalogPorts {
  clock: Clock;
  logger: Logger;
  tolerance: ClockTolerance;
  catalog: CatalogStore;
  /** The freshness budgets and the level rules each merchant resolves to (configuration module). */
  catalogPolicies: CatalogPolicies;
}

export const memoryCatalogPorts: Bindings<Pick<CatalogPorts, "catalog">> = {
  catalog: memoryCatalogStore,
};

export const configuredCatalogPorts = (
  configuration: () => ConfigurationService,
): Bindings<Pick<CatalogPorts, "catalogPolicies">> => ({
  catalogPolicies: () => catalogPoliciesOf(configuration()),
});

/** The truth service the decision plane will receive; built with the module's ports. */
export const productTruthOf = (ports: CatalogPorts): ProductTruthService =>
  new DefaultProductTruthService({
    clock: ports.clock,
    store: ports.catalog,
    policies: ports.catalogPolicies,
  });

export const catalogModule: Module<CatalogPorts> = ({ ports }) => {
  const { clock, tolerance, logger, catalog, catalogPolicies } = ports;
  const upsert = new UpsertCatalogSnapshotUseCase({
    clock,
    tolerance,
    store: catalog,
    policies: catalogPolicies,
    logger,
  });
  const logged = new LoggedUseCase("upsertCatalogSnapshot", upsert, { clock, logger });
  return { handlers: { upsertCatalogSnapshot: makeUpsertCatalogSnapshot(logged) } };
};
