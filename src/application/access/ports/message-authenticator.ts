// Message authentication port (ADR-029): the HMAC the platform signature verifier needs. The
// gateway computes it with the runtime's crypto; the domain compares.
export interface MessageAuthenticator {
  /** Lowercase hex HMAC-SHA256 of `message` keyed with `secret`. */
  hmacSha256Hex(secret: string, message: Uint8Array): Promise<string>;
}
