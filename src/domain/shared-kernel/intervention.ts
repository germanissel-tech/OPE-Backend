// Intervention vocabulary (01-arquitectura-mvp.md §3.1.1, §4.4; ADR-024, ADR-026): what the
// decision plane emits and the ledger records. Anchors are the semantic anchor points of the
// platform: replica of contracts/components/schemas/Anchor.yaml (the source); a test verifies
// they match. A new anchor is a product feature (contract, glossary, SDK anchor map, messages),
// never configuration.
export const ANCHORS = ["size_selector", "price", "cta", "policies"] as const;
export type Anchor = (typeof ANCHORS)[number];

/** The kinds of incentive the commercial policy may grant: a proportional one in the MVP (03 §4.8). */
export const INCENTIVE_KINDS = ["percent"] as const;
export type IncentiveKind = (typeof INCENTIVE_KINDS)[number];

/** An incentive the chosen intervention carries; how it is redeemed is the platform's (013/014). */
export interface Incentive {
  kind: IncentiveKind;
  value: number;
}

/**
 * What the decision plane emits when it intervenes: where to render, the curated text to render
 * there and, when the commercial policy granted one, the incentive. The text travels so the SDK
 * renders without a second round trip; the version travels so the ledger can say what the person
 * read, and keeps saying it after the corpus changes (constitution IX).
 */
export interface Intervention {
  messageVersionId: string;
  text: string;
  anchor: Anchor;
  incentive?: Incentive;
}
