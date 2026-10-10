// Merchant (01-arquitectura-mvp.md §0.1; ADR-014, ADR-024, ADR-025, ADR-029, ADR-031): the store
// that installs OPE. Identity minted by OPE, a status (on, off by the kill switch, deactivated
// for good), registered origins and credentials by kind — kept by fingerprint, at most two live
// per kind while rotating. A Merchant only exists valid: `of` judges the credential sets and
// parses every origin once; `rehydrate` trusts recorded facts. Its configuration and its
// experiments are other aggregates: this one changes rarely and only by security or operation.
import { constantTimeEquals, fail, ok, type MerchantId, type Result } from "../shared-kernel/index.js";
import { CREDENTIAL_KINDS, type Credential, type CredentialKind } from "./credential.js";
import {
  InvalidIngestKeys,
  InvalidOrigin,
  InvalidOrigins,
  InvalidPlatformKeys,
  InvalidPlatformSecret,
  InvalidPlatformSecrets,
  MerchantDeactivated,
  PlatformKeyCollision,
  RotationGraceTooLong,
  type MerchantError,
} from "./errors.js";
import { Origin, type OriginRecord } from "./origin.js";
import { MerchantProfile, type MerchantProfileRecord } from "./profile.js";

/** On, off by the kill switch (decides nothing, still measures), or deactivated for good. */
export type MerchantStatus = "active" | "off" | "deactivated";

/** What a store or the creation says about a merchant; origins as written. */
export interface MerchantInput {
  merchantId: MerchantId;
  /** Registered origins of the store: `scheme://host[:port]`, no path. */
  origins: readonly string[];
  /** Credentials by kind: at least one ingest key; at most two per kind (a rotation). */
  credentials: readonly Credential[];
  createdAt: Date;
  status?: MerchantStatus | undefined;
  /** The identity for people (ADR-045), already judged by `MerchantProfile.of`; none for a merchant nobody named. */
  profile?: MerchantProfile | undefined;
}

/**
 * The recorded facts of a merchant; origins already canonical.
 *
 * The origins are **records, not `Origin`s** (feature 037): a store gives back plain objects, and the
 * constructor is what turns them into the class — so a merchant read from a store authenticates, and a
 * part nobody converted does not compile instead of failing at the CORS edge of another request.
 */
export interface MerchantRecord {
  merchantId: MerchantId;
  status: MerchantStatus;
  origins: readonly OriginRecord[];
  credentials: readonly Credential[];
  createdAt: Date;
  /** Absent in every document written before ADR-045, and in a merchant nobody named since. */
  profile?: MerchantProfileRecord | undefined;
  /** How many changes it has had (feature 043): absent in every document written before, which reads as 0. */
  revision?: number | undefined;
}

/** A credential set is one credential, or two during a rotation (ADR-014, ADR-025, ADR-029). */
const MAX_PER_KIND = 2;

/** Whether the credential is still valid at `now` (an expiry at `now` has passed). */
function isLive(credential: Credential, now: Date): boolean {
  return credential.expiresAt === undefined || credential.expiresAt.getTime() > now.getTime();
}

/** The error that names an oversized set, by kind. */
function tooMany(kind: CredentialKind): MerchantError {
  if (kind === "ingest") return new InvalidIngestKeys();
  return kind === "platform" ? new InvalidPlatformKeys() : new InvalidPlatformSecrets();
}

export class Merchant implements MerchantRecord {
  readonly merchantId: MerchantId;
  readonly status: MerchantStatus;
  readonly origins: readonly Origin[];
  readonly credentials: readonly Credential[];
  readonly createdAt: Date;
  readonly profile: MerchantProfile | undefined;
  /** Rises with every change, whatever it changes: what makes the witness of a merchant (feature 043). */
  readonly revision: number;

  private constructor(record: MerchantRecord) {
    this.merchantId = record.merchantId;
    this.status = record.status;
    this.origins = record.origins.map((origin) => Origin.rehydrate(origin));
    this.credentials = record.credentials.map((c) => ({ ...c }));
    this.createdAt = record.createdAt;
    // Every nested class is rehydrated here, like the origins (feature 037): a document gives plain objects.
    this.profile = record.profile === undefined ? undefined : MerchantProfile.rehydrate(record.profile);
    this.revision = record.revision ?? 0;
  }

  /**
   * A merchant as created or seeded: at least one origin and every origin parseable; one or two
   * ingest credentials; at most two platform keys and two signing secrets; no empty fingerprint,
   * every signing credential with its secret, no fingerprint shared across kinds.
   */
  static of(input: MerchantInput): Result<Merchant, MerchantError> {
    const origins = Merchant.judgeOrigins(input.origins);
    if (!origins.ok) return origins;
    const judged = Merchant.judgeCredentials(input.credentials);
    if (judged !== undefined) return fail(judged);
    return ok(
      new Merchant({
        merchantId: input.merchantId,
        status: input.status ?? "active",
        origins: origins.value,
        credentials: input.credentials,
        createdAt: input.createdAt,
        profile: input.profile,
        revision: 1,
      }),
    );
  }

  /** At least one origin, every one parseable (the first that fails names its index). */
  static judgeOrigins(origins: readonly string[]): Result<Origin[], InvalidOrigin | InvalidOrigins> {
    if (origins.length === 0) return fail(new InvalidOrigins());
    const parsed: Origin[] = [];
    for (const [index, text] of origins.entries()) {
      const origin = Origin.parse(text);
      if (origin === undefined) return fail(new InvalidOrigin(index));
      parsed.push(origin);
    }
    return ok(parsed);
  }

  /** The first violated rule of a credential set, or undefined. */
  private static judgeCredentials(credentials: readonly Credential[]): MerchantError | undefined {
    const ingest = credentials.filter((c) => c.kind === "ingest");
    if (ingest.length === 0) return new InvalidIngestKeys();
    for (const kind of CREDENTIAL_KINDS) {
      if (credentials.filter((c) => c.kind === kind).length > MAX_PER_KIND) return tooMany(kind);
    }
    const seen = new Set<string>();
    for (const [index, c] of credentials.entries()) {
      if (c.fingerprint === "" || seen.has(c.fingerprint)) return Merchant.badCredential(c.kind, index);
      if (c.kind === "signing" && (c.secret === undefined || c.secret === ""))
        return new InvalidPlatformSecret(index);
      seen.add(c.fingerprint);
    }
    return undefined;
  }

  /** An empty fingerprint, or one already taken by another credential, named by the kind that carries it. */
  private static badCredential(kind: CredentialKind, index: number): MerchantError {
    if (kind === "ingest") return new InvalidIngestKeys(index);
    return kind === "platform" ? new PlatformKeyCollision(index) : new InvalidPlatformSecret(index);
  }

  /** A merchant already recorded: its facts are not re-judged. */
  static rehydrate(record: MerchantRecord): Merchant {
    return new Merchant(record);
  }

  /** A credential as the merchant keeps it: fingerprint and instant; the secret only for signing. */
  static credential(kind: CredentialKind, fingerprint: string, issuedAt: Date, secret?: string): Credential {
    return { kind, fingerprint, issuedAt, ...(secret === undefined ? {} : { secret }) };
  }

  /** The credentials of a kind still valid at `now`. */
  credentialsOf(kind: CredentialKind, now: Date): Credential[] {
    return this.credentials.filter((c) => c.kind === kind && isLive(c, now));
  }

  /** Every credential still in force at `now`, whatever its kind: what a reading may show. */
  liveCredentials(now: Date): Credential[] {
    return this.credentials.filter((c) => isLive(c, now));
  }

  /** Does a live ingest credential carry this fingerprint? Only a merchant that is not deactivated owns anything. */
  owns(fingerprint: string, now: Date): boolean {
    return (
      !this.isDeactivated() && this.credentialsOf("ingest", now).some((c) => c.fingerprint === fingerprint)
    );
  }

  /** Does a live platform credential carry this fingerprint? Constant time: the fingerprint of a secret is compared. */
  ownsPlatformKey(fingerprint: string, now: Date): boolean {
    return (
      !this.isDeactivated() &&
      this.credentialsOf("platform", now).some((c) => constantTimeEquals(c.fingerprint, fingerprint))
    );
  }

  /** The signing secrets still valid at `now`, any of which authenticates a platform request (ADR-029). */
  signingSecrets(now: Date): string[] {
    return this.credentialsOf("signing", now).flatMap((c) => (c.secret === undefined ? [] : [c.secret]));
  }

  /** With a live signing secret, every platform request must be signed (ADR-029). */
  requiresSignature(now: Date): boolean {
    return this.signingSecrets(now).length > 0;
  }

  isOn(): boolean {
    return this.status === "active";
  }

  isDeactivated(): boolean {
    return this.status === "deactivated";
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

  /**
   * The same merchant with a new credential of that kind: the previous live ones expire after
   * the grace (zero: at once); when two were live, the older one expires now. The grace is
   * bounded by the platform.
   */
  rotated(
    credential: Credential,
    grace: { graceMs: number; maxGraceMs: number },
    now: Date,
  ): Result<Merchant, RotationGraceTooLong | MerchantDeactivated> {
    if (this.isDeactivated()) return fail(new MerchantDeactivated());
    if (grace.graceMs > grace.maxGraceMs) return fail(new RotationGraceTooLong(grace.maxGraceMs));
    const expiresAt = new Date(now.getTime() + grace.graceMs);
    const live = this.credentialsOf(credential.kind, now).sort(
      (a, b) => a.issuedAt.getTime() - b.issuedAt.getTime(),
    );
    const kept = this.credentials.filter((c) => c.kind !== credential.kind || !isLive(c, now));
    const previous = live.map((c, i) => ({ ...c, expiresAt: i < live.length - 1 ? now : expiresAt }));
    return ok(this.#changed({ credentials: [...kept, ...previous, credential] }));
  }

  /** The same merchant, on or off; a deactivated one has no switch. */
  switched(on: boolean): Result<Merchant, MerchantDeactivated> {
    if (this.isDeactivated()) return fail(new MerchantDeactivated());
    if (this.isOn() === on) return ok(this);
    return ok(this.#changed({ status: on ? "active" : "off" }));
  }

  /** The same merchant, deactivated for good (idempotent). */
  deactivated(): Merchant {
    return this.isDeactivated() ? this : this.#changed({ status: "deactivated" });
  }

  /**
   * The same merchant with its identity replaced whole (ADR-045). It does not look at the status: the
   * identity belongs to the commercial relationship, so a deactivated merchant admits it too.
   */
  withProfile(profile: MerchantProfile): Merchant {
    return this.#changed({ profile: profile.record() });
  }

  /**
   * The witness of the merchant (feature 043, ADR-046): who it is and how many changes it has had. Whoever
   * replaces something it read sends it back, and a write in between makes it differ. The merchant is in it
   * because revisions repeat across merchants: the 7th of one is not the 7th of another.
   */
  witness(): string {
    return `${this.merchantId}:${this.revision}`;
  }

  /**
   * **The only way to make the next merchant**, and why it exists: a change has to raise the revision, and a
   * method that built the next one by hand could forget it — the witness would then let a write through over
   * a merchant that changed, which is the one failure the witness is for, and nothing would fail.
   */
  #changed(changes: Partial<MerchantRecord>): Merchant {
    return new Merchant({ ...this.record(), ...changes, revision: this.revision + 1 });
  }

  /** The record as a store would keep it. */
  record(): MerchantRecord {
    return {
      merchantId: this.merchantId,
      status: this.status,
      origins: this.origins,
      credentials: this.credentials,
      createdAt: this.createdAt,
      profile: this.profile?.record(),
      revision: this.revision,
    };
  }
}
