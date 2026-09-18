// Merchant (01-arquitectura-mvp.md §0.1; ADR-014, ADR-024, ADR-025): the store that installs
// OPE. Identity, ingest credentials (the tag, public), platform credentials (its backend,
// secret) and registered origins. A Merchant only exists valid: `of` parses every origin once
// and keeps the two kinds of credential apart, `rehydrate` trusts recorded facts.
import { fail, ok, type MerchantId, type Result } from "../shared-kernel/index.js";
import { InvalidOrigin, PlatformKeyCollision, type MerchantError } from "./errors.js";
import { Origin } from "./origin.js";

/** What configuration or a store says about a merchant; origins as written. */
export interface MerchantInput {
  merchantId: MerchantId;
  /** Active ingest keys: one, or two during a rotation. Public (they travel in the tag). */
  ingestKeys: readonly string[];
  /** Registered origins of the store: `scheme://host[:port]`, no path. */
  origins: readonly string[];
  /** Server-to-server keys of the platform (ADR-025): none, one, or two during a rotation. */
  platformKeys?: readonly string[];
}

/** The recorded facts of a merchant; origins already canonical. */
export interface MerchantRecord {
  merchantId: MerchantId;
  ingestKeys: readonly string[];
  origins: readonly Origin[];
  platformKeys: readonly string[];
}

export class Merchant {
  readonly merchantId: MerchantId;
  readonly ingestKeys: readonly string[];
  readonly origins: readonly Origin[];
  readonly platformKeys: readonly string[];

  private constructor(record: MerchantRecord) {
    this.merchantId = record.merchantId;
    this.ingestKeys = [...record.ingestKeys];
    this.origins = [...record.origins];
    this.platformKeys = [...record.platformKeys];
  }

  /**
   * A merchant as configured: every origin must parse and every platform key must be non-empty
   * and distinct from the ingest keys (the first that fails names its index).
   */
  static of(input: MerchantInput): Result<Merchant, MerchantError> {
    const origins: Origin[] = [];
    for (const [index, text] of input.origins.entries()) {
      const origin = Origin.parse(text);
      if (origin === undefined) return fail(new InvalidOrigin(index));
      origins.push(origin);
    }
    const platformKeys = input.platformKeys ?? [];
    for (const [index, key] of platformKeys.entries()) {
      if (key === "" || input.ingestKeys.includes(key)) return fail(new PlatformKeyCollision(index));
    }
    return ok(
      new Merchant({ merchantId: input.merchantId, ingestKeys: input.ingestKeys, origins, platformKeys }),
    );
  }

  /** A merchant already recorded: its facts are not re-judged. */
  static rehydrate(record: MerchantRecord): Merchant {
    return new Merchant(record);
  }

  /** Does this ingest credential belong to the merchant? Exact comparison; an empty key belongs to nobody. */
  owns(key: string): boolean {
    return key !== "" && this.ingestKeys.includes(key);
  }

  /** Does this platform credential belong to the merchant? Same rules as `owns`. */
  ownsPlatformKey(key: string): boolean {
    return key !== "" && this.platformKeys.includes(key);
  }

  /**
   * May this origin speak on behalf of the merchant? Without `Origin` (server to server, tests)
   * there is nothing to verify: the control is the pair credential + origin when the origin exists.
   */
  allowsOrigin(text: string | undefined): boolean {
    if (text === undefined) return true;
    const wanted = Origin.parse(text);
    if (wanted === undefined) return false;
    return this.origins.some((o) => o.equals(wanted));
  }
}
