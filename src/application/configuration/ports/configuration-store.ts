// Configuration store port (ADR-031): the versions a merchant published, numbered by the store
// itself — the next number of the merchant is assigned and the version recorded in one step
// (01 §6), so two operators publishing at once never share a number. Nothing is ever
// overwritten. Every write returns Result (ADR-021): StoreUnavailable, never a throw.
import type {
  ConfigurationDraft,
  MerchantConfigurationVersion,
} from "../../../domain/configuration/index.js";
import type { MerchantId, Result, StoreUnavailable } from "../../../domain/shared-kernel/index.js";
import type { Page, PageQuery } from "../../shared-kernel/index.js";

export interface ConfigurationStore {
  /** Records the draft as the next version of its merchant and answers it numbered. */
  publish(draft: ConfigurationDraft): Promise<Result<MerchantConfigurationVersion, StoreUnavailable>>;
  /** The version in force, or undefined when the merchant never published one. */
  latestOf(merchantId: MerchantId): Promise<MerchantConfigurationVersion | undefined>;
  /** The versions of the merchant, newest first. */
  versionsOf(merchantId: MerchantId, query: PageQuery): Promise<Page<MerchantConfigurationVersion>>;
}
