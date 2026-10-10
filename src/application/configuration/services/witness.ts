// The witness of a merchant's configuration (feature 043, ADR-046): what a read hands out and a publication is
// judged by. One function for the two, so the read and the write can never disagree on what it is.
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

/**
 * The merchant and the number of the version in force, or 0 when the merchant never published one.
 *
 * **The merchant is in it because the numbers repeat**: every merchant numbers its own versions, so version 5
 * of one and version 5 of another would be the same witness, and a write meant for one would pass on the
 * other.
 */
export function merchantConfigurationWitness(merchantId: MerchantId, version: number | undefined): string {
  return `${merchantId}:configuration:${version ?? 0}`;
}
