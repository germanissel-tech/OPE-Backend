// Business errors of the messages module (ADR-023): returned, never thrown. Every `code` is a slug
// of contracts/problem-types.yaml, and **one code per class**: the three about the corpus share a
// consequence —it is not servable, so the server does not start (constitution II)— but not a code,
// because what a reader needs to know is which of the three happened.
import { DomainError } from "../shared-kernel/index.js";
import type { MessageVersion } from "./ids.js";

const MODULE = "messages" as const;

/** A text of the corpus is empty: nothing to show is not a text, it is an absent one. */
export class EmptyText extends DomainError {
  readonly code = "corpus-text-empty" as const;
  readonly module = MODULE;
  constructor(version: MessageVersion) {
    super("A curated text cannot be empty.", { version });
  }
}

/** Longer than what the contract publishes: it would be cut where nobody decided to cut it. */
export class TextTooLong extends DomainError {
  readonly code = "corpus-text-too-long" as const;
  readonly module = MODULE;
  constructor(version: MessageVersion, length: number) {
    super("A curated text is longer than the contract allows.", { version, length });
  }
}

/**
 * A slot nobody filled: someone wrote a template where the corpus takes prose. It is the only
 * mechanical defence against a template reaching a person with the slot still in it.
 */
export class UnresolvedPlaceholder extends DomainError {
  readonly code = "corpus-text-has-placeholder" as const;
  readonly module = MODULE;
  constructor(version: MessageVersion) {
    super("A curated text still carries a placeholder; the corpus takes complete prose.", { version });
  }
}

/**
 * A correspondence of the merchant names a value OPE writes no texts for. Over HTTP the schema
 * refuses it by itself —the vocabulary is an enum— so this is the seed's path, where the shape is
 * read and the domain judges (ADR-024).
 */
export class UnknownAttributeValue extends DomainError {
  readonly code = "unknown-attribute-value" as const;
  readonly module = MODULE;
  constructor(value: string) {
    super("The attribute value is not one OPE writes texts for.", { value });
  }
}

/** One label pointing at two values: there would be no way to tell what a product carrying it says. */
export class DuplicateAttributeLabel extends DomainError {
  readonly code = "duplicate-attribute-label" as const;
  readonly module = MODULE;
  constructor(label: string) {
    super("One attribute label corresponds to two values of OPE's vocabulary.", { label });
  }
}

export type MessageError =
  EmptyText | TextTooLong | UnresolvedPlaceholder | UnknownAttributeValue | DuplicateAttributeLabel;
