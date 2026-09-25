// Identity of the messages module (ADR-024): a version has an owner, so it lives here and not in
// the shared kernel, which carries only what modules that cannot depend on each other share.
import type { Branded } from "../shared-kernel/index.js";

/**
 * The version of a curated text. **Immutable**: correcting a text mints a new version, never edits
 * an existing one — otherwise a change to the corpus would rewrite what the ledger says a person
 * read, and the traceability of constitution IX falls with it.
 */
export type MessageVersion = Branded<string, "MessageVersion">;

/** A version as the corpus declares it; the shape is all the domain judges. */
export const messageVersion = (value: string): MessageVersion => value as MessageVersion;
