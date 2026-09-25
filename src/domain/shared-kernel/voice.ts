// The registers a curated text is written in (03 §4.4): replica of
// contracts/components/schemas/Voice.yaml (the source); a test verifies they match. A new voice is
// a product decision —someone writes its texts— never configuration.
export const VOICES = ["neutral"] as const;
export type Voice = (typeof VOICES)[number];

/** The voice used when the merchant's has no text for the family and language resolved. */
export const DEFAULT_VOICE: Voice = "neutral";
