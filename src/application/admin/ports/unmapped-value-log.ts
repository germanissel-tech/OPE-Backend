// Unmapped attribute values log port (01 §3.1.1, ADR-031, feature 027): what the last catalogue of
// a merchant brought with no correspondence in OPE's vocabulary, bounded by the platform
// configuration. The same shape as the anchor diagnostics: bounded per merchant, the oldest goes
// first, and it never refuses — a catalogue is ingested whether or not this is written.
import type { UnmappedAttributeValue } from "../../../domain/admin/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";
import type { Page, PageQuery } from "../../shared-kernel/index.js";

/** One label of the last catalogue and how many products carry it. */
export interface UnmappedValueSighting {
  label: string;
  products: number;
}

export interface UnmappedValueLog {
  /**
   * Replaces what the merchant's catalogue brings: a catalogue is a replacement, so a label that
   * stopped arriving stops being a gap. A label already recorded keeps the instant it was first
   * seen; over the limit the oldest goes first.
   */
  replace(merchantId: MerchantId, seen: readonly UnmappedValueSighting[], at: Date): Promise<void>;
  /**
   * Most recent first, without the labels the merchant maps today: mapping a value takes it off the
   * report without republishing the catalogue, which is how an operator sees that the fix landed.
   */
  pendingOf(
    merchantId: MerchantId,
    mapped: ReadonlySet<string>,
    query: PageQuery,
  ): Promise<Page<UnmappedAttributeValue>>;
}
