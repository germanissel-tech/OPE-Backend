// Freshness budgets by class of datum (01 §8; ADR-025), measured from `capturedAt`: catalogue
// and variants stay true for the order of a day; availability and price for the order of
// minutes. Published in the description of upsertCatalogSnapshot; per merchant once the
// configuration API exists (`putFlags`, contracts/api-map.yaml).
import { hours, minutes } from "../../../domain/shared-kernel/index.js";

export interface FreshnessBudget {
  /** Beyond this the snapshot holds no truth at all. */
  catalogMs: number;
  /** Beyond this the variant exists but availability and price no longer sustain a claim. */
  stockAndPriceMs: number;
}

const CATALOG_HOURS = 36;
const STOCK_AND_PRICE_MINUTES = 15;

export const FRESHNESS_BUDGET: FreshnessBudget = {
  catalogMs: hours(CATALOG_HOURS),
  stockAndPriceMs: minutes(STOCK_AND_PRICE_MINUTES),
};
