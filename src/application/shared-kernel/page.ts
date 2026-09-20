// A page of a collection as the admin and portal readers get it (ADR-020): items and an opaque
// cursor for the next page, or none. `limit` is what the caller asked for; the gateway caps it.
export interface PageQuery {
  cursor?: string | undefined;
  limit: number;
}

export interface Page<T> {
  items: readonly T[];
  nextCursor?: string | undefined;
}
