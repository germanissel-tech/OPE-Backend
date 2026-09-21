// Merchant store port (ADR-031): the single source of truth of the merchants, by intention.
// The entity already decided (rotated, switched, deactivated): the store keeps what it is told.
// In memory today; the persistence feature adds another gateway without touching the core.
import type { Merchant } from "../../../domain/merchant/index.js";
import type { MerchantId, Result, StoreUnavailable } from "../../../domain/shared-kernel/index.js";
import type { Page, PageQuery } from "../../shared-kernel/index.js";

export interface MerchantStore {
  /** Records a new merchant; its identifier was minted for it and is not reused. */
  create(merchant: Merchant): Promise<Result<undefined, StoreUnavailable>>;
  /** Replaces the recorded facts of an existing merchant with what the entity decided. */
  update(merchant: Merchant): Promise<Result<undefined, StoreUnavailable>>;
  get(merchantId: MerchantId): Promise<Merchant | undefined>;
  /** Oldest first. */
  list(query: PageQuery): Promise<Page<Merchant>>;
  /** Whether any merchant (deactivated ones included) registered this origin: an origin belongs to one merchant. */
  ownerOfOrigin(origin: string): Promise<MerchantId | undefined>;
  /** Whether the store holds any merchant at all: the seed is imported only into an empty one. */
  isEmpty(): Promise<boolean>;
}
