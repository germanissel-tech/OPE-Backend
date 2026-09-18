// Intervention vocabulary (01-arquitectura-mvp.md §3.1.1, §4.4; ADR-024, ADR-026): what the
// decision plane emits and the ledger records. Anchors are the semantic anchor points of the
// platform: replica of contracts/components/schemas/Anchor.yaml (the source); a test verifies
// they match. A new anchor is a product feature (contract, glossary, SDK anchor map, messages),
// never configuration.
export const ANCHORS = ["size_selector", "price", "cta", "policies"] as const;
export type Anchor = (typeof ANCHORS)[number];

/** Where to render and which curated message version to fetch (feature 015 serves the text). */
export interface Intervention {
  messageVersionId: string;
  anchor: Anchor;
}
