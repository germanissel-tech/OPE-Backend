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

/**
 * A key no text can have (feature 038): a family the plane cannot choose, a value OPE writes no texts for,
 * a value on a family that says nothing of the product, or a language that is not a language tag. The
 * API never creates keys; the pointer says which of the four was wrong.
 */
export class TextKeyUnknown extends DomainError {
  readonly code = "text-key-unknown" as const;
  readonly module = MODULE;
  constructor(part: "family" | "attributeValue" | "locale", value: string) {
    // `pointer` is what the HTTP border turns into the field of the body that is wrong; `value` says what it held.
    super("The text key names something OPE has no text for.", { pointer: part, value });
  }
}

/** The base layer never loses a text: it has to stay complete for every supported language (feature 038). */
export class BaseTextRequired extends DomainError {
  readonly code = "base-text-required" as const;
  readonly module = MODULE;
  constructor() {
    super("A base text cannot be removed: the base layer stays complete.");
  }
}

/**
 * No version of the key where one was asked for (feature 038): a history is read by number, and removing a
 * merchant's text needs one in force to repeat or to send back to the base.
 */
export class TextVersionNotFound extends DomainError {
  readonly code = "text-version-not-found" as const;
  readonly module = MODULE;
  private constructor(message: string) {
    super(message);
  }

  static numbered(version: number): TextVersionNotFound {
    return new TextVersionNotFound(`The key has no version ${version}.`);
  }

  static inForce(): TextVersionNotFound {
    return new TextVersionNotFound("The merchant has no text of its own for the key.");
  }
}

/**
 * A language with no complete base (feature 038): it cannot be supported, named as reserve, or left by the seed.
 * The families it lacks travel in the details as one string, which is what an operator needs to complete it;
 * the details of an error are scalars, so whoever has the list joins it.
 */
export class LocaleIncomplete extends DomainError {
  readonly code = "locale-incomplete" as const;
  readonly module = MODULE;
  constructor(locale: string, missing: string) {
    super("The base layer has no text for some families in that language.", { locale, missing });
  }
}

/** What a text in itself can be refused for: the three rules of `CuratedText.of`. */
export type CuratedTextError = EmptyText | TextTooLong | UnresolvedPlaceholder;

/** What a publication of a text can be refused for, before anything is written (feature 038). */
export type TextDraftError = CuratedTextError | TextKeyUnknown | BaseTextRequired;

export type MessageError =
  | EmptyText
  | TextTooLong
  | UnresolvedPlaceholder
  | UnknownAttributeValue
  | DuplicateAttributeLabel
  | TextKeyUnknown
  | BaseTextRequired
  | TextVersionNotFound
  | LocaleIncomplete;
