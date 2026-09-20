// Merchant (01-arquitectura-mvp.md §0.1; ADR-014, ADR-024, ADR-025, ADR-029): the store that
// installs OPE. Identity, ingest credentials (the tag, public), platform credentials (its
// backend, secret) and registered origins. A Merchant only exists valid: `of` judges the size of
// every credential set (one or two keys, a rotation at most), parses every origin once and keeps
// the two kinds of credential apart; `rehydrate` trusts recorded facts.
import { constantTimeEquals, fail, ok, type MerchantId, type Result } from "../shared-kernel/index.js";
import {
  InvalidIngestKeys,
  InvalidOrigin,
  InvalidOrigins,
  InvalidPlatformKeys,
  InvalidPlatformSecret,
  InvalidPlatformSecrets,
  PlatformKeyCollision,
  type MerchantError,
} from "./errors.js";
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
  /** Signing secrets of the platform (ADR-029): none, one, or two during a rotation. With any, every platform request must be signed. */
  platformSecrets?: readonly string[];
}

/** The recorded facts of a merchant; origins already canonical. */
export interface MerchantRecord {
  merchantId: MerchantId;
  ingestKeys: readonly string[];
  origins: readonly Origin[];
  platformKeys: readonly string[];
  platformSecrets: readonly string[];
}

/** A credential set is one key, or two during a rotation (ADR-014, ADR-025, ADR-029). */
const MAX_KEYS_PER_SET = 2;

export class Merchant {
  readonly merchantId: MerchantId;
  readonly ingestKeys: readonly string[];
  readonly origins: readonly Origin[];
  readonly platformKeys: readonly string[];
  readonly platformSecrets: readonly string[];

  private constructor(record: MerchantRecord) {
    this.merchantId = record.merchantId;
    this.ingestKeys = [...record.ingestKeys];
    this.origins = [...record.origins];
    this.platformKeys = [...record.platformKeys];
    this.platformSecrets = [...record.platformSecrets];
  }

  /**
   * A merchant as configured: one or two non-empty ingest keys, at least one origin and every
   * origin parseable, at most two platform keys each non-empty and distinct from the ingest
   * keys, at most two signing secrets each non-empty and distinct from every key (the first
   * that fails names its index).
   */
  static of(input: MerchantInput): Result<Merchant, MerchantError> {
    if (input.ingestKeys.length === 0 || input.ingestKeys.length > MAX_KEYS_PER_SET) {
      return fail(new InvalidIngestKeys());
    }
    const emptyKey = input.ingestKeys.findIndex((key) => key === "");
    if (emptyKey !== -1) return fail(new InvalidIngestKeys(emptyKey));
    if (input.origins.length === 0) return fail(new InvalidOrigins());
    const origins: Origin[] = [];
    for (const [index, text] of input.origins.entries()) {
      const origin = Origin.parse(text);
      if (origin === undefined) return fail(new InvalidOrigin(index));
      origins.push(origin);
    }
    const platformKeys = input.platformKeys ?? [];
    if (platformKeys.length > MAX_KEYS_PER_SET) return fail(new InvalidPlatformKeys());
    for (const [index, key] of platformKeys.entries()) {
      if (key === "" || input.ingestKeys.includes(key)) return fail(new PlatformKeyCollision(index));
    }
    const platformSecrets = input.platformSecrets ?? [];
    if (platformSecrets.length > MAX_KEYS_PER_SET) return fail(new InvalidPlatformSecrets());
    for (const [index, secret] of platformSecrets.entries()) {
      if (secret === "" || input.ingestKeys.includes(secret) || platformKeys.includes(secret)) {
        return fail(new InvalidPlatformSecret(index));
      }
    }
    return ok(
      new Merchant({
        merchantId: input.merchantId,
        ingestKeys: input.ingestKeys,
        origins,
        platformKeys,
        platformSecrets,
      }),
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

  /**
   * Does this platform credential belong to the merchant? The key is a secret (ADR-029), so the
   * comparison takes the same time whatever the first differing character; an empty key
   * belongs to nobody.
   */
  ownsPlatformKey(key: string): boolean {
    return key !== "" && this.platformKeys.some((own) => constantTimeEquals(own, key));
  }

  /** With a signing secret configured, every platform request must be signed (ADR-029). */
  requiresSignature(): boolean {
    return this.platformSecrets.length > 0;
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
