// catalog module (ADR-025): the merchant's catalogue snapshot, what it needs (`CatalogPorts`),
// how memory serves it (`memoryCatalogPorts`) and what it serves (`upsertCatalogSnapshot`).
// The product-truth service is built here for whoever decides (feature 011).
import {
  DefaultProductTruthService,
  UpsertCatalogSnapshotUseCase,
  type CatalogStore,
  type ProductTruthService,
} from "../../application/catalog/index.js";
import { LoggedUseCase, type Clock, type Logger } from "../../application/shared-kernel/index.js";
import { memoryCatalogStore } from "../../interface-adapters/gateways/catalog/memory-catalog-store.js";
import { makeUpsertCatalogSnapshot } from "../../interface-adapters/http/controllers/catalog/upsert-catalog-snapshot.js";
import type { Bindings, Module } from "../wiring.js";

export interface CatalogPorts {
  clock: Clock;
  logger: Logger;
  catalog: CatalogStore;
}

export const memoryCatalogPorts: Bindings<Pick<CatalogPorts, "catalog">> = {
  catalog: memoryCatalogStore,
};

/** The truth service the decision plane will receive; built with the module's ports. */
export const productTruthOf = (ports: CatalogPorts): ProductTruthService =>
  new DefaultProductTruthService({ clock: ports.clock, store: ports.catalog });

export const catalogModule: Module<CatalogPorts> = ({ ports }) => {
  const { clock, logger, catalog } = ports;
  const upsert = new UpsertCatalogSnapshotUseCase({ clock, store: catalog, logger });
  const logged = new LoggedUseCase("upsertCatalogSnapshot", upsert, { clock, logger });
  return { handlers: { upsertCatalogSnapshot: makeUpsertCatalogSnapshot(logged) } };
};
