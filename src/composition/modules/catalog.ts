// catalog module (ADR-025): the merchant's catalogue snapshot. It declares the port of its
// policies —the freshness budgets and the level rules, which the configuration resolves per
// merchant and binds— and exposes the truth of product the decision plane consults.
import {
  ProductTruths,
  UpsertCatalogSnapshotUseCase,
  type CatalogPolicies,
  type CatalogStore,
  type ProductTruthService,
} from "../../application/catalog/index.js";
import { makeUpsertCatalogSnapshot, memoryCatalogStore } from "../../interface-adapters/catalog/index.js";
import { bind, compositionModule, handler, port } from "../graph/index.js";
import { ClockPort, ClockTolerancePort, DecoratorsPort, LoggerPort } from "./shared-kernel.js";

export const CatalogStorePort = port("catalog.store")<CatalogStore>();
/** The freshness budgets and the level rules of each merchant; the configuration binds them. */
export const CatalogPoliciesPort = port("catalog.policies")<CatalogPolicies>();
/** What the decision plane consults: what is known of a product, and how fresh. */
export const ProductTruthPort = port("catalog.product-truth")<ProductTruthService>();

export const catalogModule = compositionModule({
  provides: [bind(CatalogStorePort, {}, () => memoryCatalogStore())],
  assembles: [
    bind(
      ProductTruthPort,
      { clock: ClockPort, store: CatalogStorePort, policies: CatalogPoliciesPort },
      (deps) => new ProductTruths(deps),
    ),
  ],
  serves: {
    handlers: {
      upsertCatalogSnapshot: handler(
        {
          deco: DecoratorsPort,
          clock: ClockPort,
          tolerance: ClockTolerancePort,
          logger: LoggerPort,
          store: CatalogStorePort,
          policies: CatalogPoliciesPort,
        },
        (operation, { deco, ...deps }) =>
          makeUpsertCatalogSnapshot(deco.logged(operation, new UpsertCatalogSnapshotUseCase(deps))),
      ),
    },
  },
});
