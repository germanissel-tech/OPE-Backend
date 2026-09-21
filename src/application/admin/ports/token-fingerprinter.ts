// Fingerprint port (ADR-031): the one-way digest of a presented token. The digest lives behind
// a port because the application ring imports nothing from Node.
export interface TokenFingerprinter {
  /** Lowercase hex SHA-256 of the token. */
  fingerprintOf(token: string): Promise<string>;
}
