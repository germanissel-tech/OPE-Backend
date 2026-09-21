// Credential (ADR-014, ADR-025, ADR-029, ADR-031): what a merchant presents to OPE. Keys (the
// ingest key of the tag, the platform key of its backend) are kept by fingerprint only; the
// signing secret keeps its value because the HMAC needs it. A rotation gives the previous one
// an expiry; a credential that expired belongs to nobody. A value without rules: a type.
export type CredentialKind = "ingest" | "platform" | "signing";

export const CREDENTIAL_KINDS: readonly CredentialKind[] = ["ingest", "platform", "signing"];

export interface Credential {
  kind: CredentialKind;
  /** SHA-256 hex of the value; for `signing`, of the secret. */
  fingerprint: string;
  /** Only `signing`: the secret itself, never published. */
  secret?: string | undefined;
  issuedAt: Date;
  /** Only after a rotation: the instant the previous credential stops being valid. */
  expiresAt?: Date | undefined;
}
