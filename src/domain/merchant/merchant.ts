// Merchant (01-arquitectura-mvp.md §0.1): the store that installs OPE. The minimum for this
// feature: identity, ingest credentials and registered origins (ADR-014).
import type { MerchantId } from "../shared-kernel/index.js";

export interface Merchant {
  merchantId: MerchantId;
  /** Active ingest keys: one, or two during a rotation. Public (they travel in the tag). */
  ingestKeys: readonly string[];
  /** Registered origins of the store: `scheme://host[:port]`, no path. */
  origins: readonly string[];
}

/** Canonical form of an origin: lowercase scheme and host, no path, no trailing slash. */
export function normalizeOrigin(origin: string): string | undefined {
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#\s]+)$/i.exec(origin.trim());
  if (!match) return undefined;
  const [, scheme = "", authority = ""] = match;
  return `${scheme.toLowerCase()}://${authority.toLowerCase()}`;
}

/**
 * May this origin speak on behalf of the merchant? Without `Origin` (server to server, tests)
 * there is nothing to verify: the control is the pair credential + origin when the origin exists.
 */
export function originAllowed(merchant: Merchant, origin: string | undefined): boolean {
  if (origin === undefined) return true;
  const wanted = normalizeOrigin(origin);
  if (wanted === undefined) return false;
  return merchant.origins.some((o) => normalizeOrigin(o) === wanted);
}

/** Resolves the credential to its merchant. Exact comparison; a key belongs to a single merchant. */
export function findByIngestKey(merchants: readonly Merchant[], key: string): Merchant | undefined {
  if (key === "") return undefined;
  return merchants.find((m) => m.ingestKeys.includes(key));
}
