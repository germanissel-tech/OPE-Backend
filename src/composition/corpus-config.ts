// The curated corpus of the release (feature 027, constitution VIII): the texts a person sees,
// written and reviewed before being served. This reads its shape and the domain judges every
// entry; an entry the domain refuses is a ConfigError, so a corpus that cannot be shown does not
// start the server (constitution II).
import path from "node:path";
import { CuratedText, messageVersion } from "../domain/messages/index.js";
import { CANDIDATES } from "../domain/selection/index.js";
import { DEFAULT_VOICE, VOICES, type Voice } from "../domain/shared-kernel/index.js";
import { ConfigError } from "./config-error.js";
import { parseJson, text } from "./env.js";
import type { CorpusEntry } from "../interface-adapters/messages/index.js";

/** The file of the release that holds the corpus. */
const CORPUS_FILE = "config/messages.json";
const VARIABLE = "OPE_MESSAGE_CORPUS";

/** Every message family the decision plane may choose: what a corpus entry is allowed to name. */
const FAMILIES: ReadonlySet<string> = new Set(
  Object.values(CANDIDATES)
    .flat()
    .map((candidate) => candidate.candidateId),
);

/**
 * `OPE_MESSAGE_CORPUS` names the file; the one of the repository otherwise. Beyond the shape of
 * each entry, three things make a corpus servable, and a corpus that is not does not start the
 * server (constitution II):
 *
 * 1. every entry names a family the plane can actually choose — a text nobody can reach is a text
 *    that was written for nothing, and almost always a typo in the family;
 * 2. no version says two different things, because the ledger records the version and a person read
 *    one of them;
 * 3. every family has a text in the default language and voice, so a merchant that configured
 *    nothing can still say something. Without this `message-unavailable` would be the normal case
 *    instead of the exception, and silence would look like a decision.
 */
export function readCorpus(
  env: NodeJS.ProcessEnv,
  readFile: (file: string) => string,
  defaultLocale: string,
): readonly CorpusEntry[] {
  const raw = parseJson(VARIABLE, readFile(path.resolve(text(env, VARIABLE) ?? CORPUS_FILE)));
  const texts = isObject(raw) ? raw["texts"] : undefined;
  if (!Array.isArray(texts)) throw new ConfigError(VARIABLE, "must hold a list of texts");
  const entries = texts.map((entry, index) => entryOf(entry, index));
  refuseUnreachable(entries);
  refuseAmbiguousVersions(entries);
  refuseIncompleteDefault(entries, defaultLocale);
  return entries;
}

/** A text of a family the plane cannot choose is unreachable: almost always a typo. */
function refuseUnreachable(entries: readonly CorpusEntry[]): void {
  const stray = entries.find((entry) => !FAMILIES.has(entry.key.family));
  if (stray !== undefined) {
    throw new ConfigError(VARIABLE, `names a family no candidate has: ${stray.key.family}`);
  }
}

/** One version, one text: the ledger records the version and a person read one text, not two. */
function refuseAmbiguousVersions(entries: readonly CorpusEntry[]): void {
  const byVersion = new Map<string, string>();
  for (const { text: curated } of entries) {
    const seen = byVersion.get(curated.version);
    if (seen !== undefined && seen !== curated.value) {
      throw new ConfigError(VARIABLE, `version ${curated.version} says two different things`);
    }
    byVersion.set(curated.version, curated.value);
  }
}

/** Without a text per family in the default language, silence would be the normal answer. */
function refuseIncompleteDefault(entries: readonly CorpusEntry[], defaultLocale: string): void {
  // The voice is not compared: with a single voice every entry is in the default one and the
  // compiler knows it. It returns to this filter with the second voice.
  const served = new Set(
    entries.filter((entry) => entry.key.locale === defaultLocale).map((entry) => entry.key.family),
  );
  const missing = [...FAMILIES].find((family) => !served.has(family));
  if (missing !== undefined) {
    throw new ConfigError(VARIABLE, `has no text for ${missing} in ${defaultLocale}/${DEFAULT_VOICE}`);
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function entryOf(raw: unknown, index: number): CorpusEntry {
  const where = `texts[${index}]`;
  if (!isObject(raw)) throw new ConfigError(VARIABLE, `${where} is not an object`);
  const family = keyAt(raw, "family", where);
  const locale = keyAt(raw, "locale", where);
  const voice = keyAt(raw, "voice", where);
  if (!isVoice(voice)) throw new ConfigError(VARIABLE, `${where}.voice is not a voice OPE writes texts in`);
  // The text itself is the domain's to judge: empty, too long or still a template are its rules,
  // and repeating them here would give the same fault two messages.
  const value = raw["text"];
  if (typeof value !== "string") throw new ConfigError(VARIABLE, `${where}.text must be a string`);
  const text = CuratedText.of(messageVersion(keyAt(raw, "version", where)), value);
  if (!text.ok) throw new ConfigError(VARIABLE, `${where}: ${text.error.message}`);
  return { key: { family, locale, voice }, text: text.value };
}

const isVoice = (value: string): value is Voice => (VOICES as readonly string[]).includes(value);

/** A field of the key: the reader owns its shape, because no factory of the domain judges it. */
function keyAt(raw: Record<string, unknown>, field: string, where: string): string {
  const value = raw[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ConfigError(VARIABLE, `${where}.${field} must be a non-empty string`);
  }
  return value;
}
