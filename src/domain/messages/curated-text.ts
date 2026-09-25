// A curated text (03 §4.4): the unit a person sees, written and reviewed before it is served.
// Only exists valid: if you hold one, it can be shown.
import { fail, ok, type Result } from "../shared-kernel/index.js";
import { EmptyText, TextTooLong, UnresolvedPlaceholder, type MessageError } from "./errors.js";
import type { MessageVersion } from "./ids.js";

/** What the contract publishes as the maximum length of `Intervention.text`. */
const MAX_LENGTH = 512;

/**
 * A slot left by a template. The corpus is **complete prose, never a template**: a value
 * interpolated into a sentence has to agree with it in gender and number, which no slot can
 * guarantee in the languages this runs in, and the result reads like a spec sheet — the opposite
 * of a curated message. This is the only mechanical defence: a text that still carries a slot
 * would reach a person with the slot in it.
 */
const PLACEHOLDER = /\{[^}]*\}/u;

export class CuratedText {
  readonly version: MessageVersion;
  readonly value: string;

  private constructor(version: MessageVersion, value: string) {
    this.version = version;
    this.value = value;
  }

  static of(version: MessageVersion, value: string): Result<CuratedText, MessageError> {
    const trimmed = value.trim();
    if (trimmed === "") return fail(new EmptyText(version));
    if (trimmed.length > MAX_LENGTH) return fail(new TextTooLong(version, trimmed.length));
    if (PLACEHOLDER.test(trimmed)) return fail(new UnresolvedPlaceholder(version));
    return ok(new CuratedText(version, trimmed));
  }
}
