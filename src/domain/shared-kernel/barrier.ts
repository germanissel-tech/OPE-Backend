// The three barriers of the MVP (03-alcance-mvp.md §4.2, DECIDIDO; ADR-026): fit (size and
// fit), price (price and value), returns (exchanges and returns). Shared by the barrier
// module (which infers one), the decision module (which decides on one) and the ledger (which
// records one). A fourth barrier is product scope, never configuration.
export const BARRIERS = ["fit", "price", "returns"] as const;
export type Barrier = (typeof BARRIERS)[number];
