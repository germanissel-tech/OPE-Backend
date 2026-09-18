// Merchant (01-arquitectura-mvp.md §0.1; ADR-014, ADR-024): the store that installs OPE.
// Identity, ingest credentials and registered origins. A Merchant only exists valid: `of`
// parses every origin once, `rehydrate` trusts recorded facts.
import { fail, ok, type MerchantId, type Result } from "../shared-kernel/index.js";
import { InvalidOrigin, type MerchantError } from "./errors.js";
import { Origin } from "./origin.js";

/** What configuration or a store says about a merchant; origins as written. */
export interface MerchantInput {
  merchantId: MerchantId;
  /** Active ingest keys: one, or two during a rotation. Public (they travel in the tag). */
  ingestKeys: readonly string[];
  /** Registered origins of the store: `scheme://host[:port]`, no path. */
  origins: readonly string[];
}

/** The recorded facts of a merchant; origins already canonical. */
export interface MerchantRecord {
  merchantId: MerchantId;
  ingestKeys: readonly string[];
  origins: readonly Origin[];
}

export class Merchant {
  readonly merchantId: MerchantId;
  readonly ingestKeys: readonly string[];
  readonly origins: readonly Origin[];

  private constructor(record: MerchantRecord) {
    this.merchantId = record.merchantId;
    this.ingestKeys = [...record.ingestKeys];
    this.origins = [...record.origins];
  }

  /** A merchant as configured: every origin must parse; the first that does not names its index. */
  static of(input: MerchantInput): Result<Merchant, MerchantError> {
    const origins: Origin[] = [];
    for (const [index, text] of input.origins.entries()) {
      const origin = Origin.parse(text);
      if (origin === undefined) return fail(new InvalidOrigin(index));
      origins.push(origin);
    }
    return ok(new Merchant({ merchantId: input.merchantId, ingestKeys: input.ingestKeys, origins }));
  }

  /** A merchant already recorded: its facts are not re-judged. */
  static rehydrate(record: MerchantRecord): Merchant {
    return new Merchant(record);
  }

  /** Does this credential belong to the merchant? Exact comparison; an empty key belongs to nobody. */
  owns(key: string): boolean {
    return key !== "" && this.ingestKeys.includes(key);
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
