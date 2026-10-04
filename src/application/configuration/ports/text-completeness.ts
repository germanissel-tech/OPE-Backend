// What configuration asks of the texts (feature 038, FR-010): which families the base layer still lacks
// in a language. The texts module answers it from its own store; configuration never learns how a text is
// kept, only whether a language could be served.
export interface TextCompleteness {
  /** The unconditional families the base holds no text for in `locale`, in the order of the vocabulary. */
  missingFor(locale: string): Promise<readonly string[]>;
}
