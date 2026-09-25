// The curated corpus of the release (feature 027, constitution VIII): the texts a person sees,
// written and reviewed before being served. This reads its shape and the domain judges every
// entry; an entry the domain refuses is a ConfigError, so a corpus that cannot be shown does not
// start the server (constitution II).
import path from "node:path";
import { CuratedText, messageVersion } from "../domain/messages/index.js";
import { VOICES, type Voice } from "../domain/shared-kernel/index.js";
import { ConfigError } from "./config-error.js";
import { parseJson, text } from "./env.js";
import type { CorpusEntry } from "../interface-adapters/messages/index.js";

/** The file of the release that holds the corpus. */
const CORPUS_FILE = "config/messages.json";
const VARIABLE = "OPE_MESSAGE_CORPUS";

/** `OPE_MESSAGE_CORPUS` names the file; the one of the repository otherwise. */
export function readCorpus(
  env: NodeJS.ProcessEnv,
  readFile: (file: string) => string,
): readonly CorpusEntry[] {
  const raw = parseJson(VARIABLE, readFile(path.resolve(text(env, VARIABLE) ?? CORPUS_FILE)));
  const texts = isObject(raw) ? raw["texts"] : undefined;
  if (!Array.isArray(texts)) throw new ConfigError(VARIABLE, "must hold a list of texts");
  return texts.map((entry, index) => entryOf(entry, index));
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function entryOf(raw: unknown, index: number): CorpusEntry {
  const where = `${VARIABLE}.texts[${index}]`;
  if (!isObject(raw)) throw new ConfigError(VARIABLE, `texts[${index}] is not an object`);
  const family = stringAt(raw, "family", where);
  const locale = stringAt(raw, "locale", where);
  const voice = stringAt(raw, "voice", where);
  if (!isVoice(voice)) throw new ConfigError(VARIABLE, `texts[${index}].voice is not a voice OPE writes in`);
  const text = CuratedText.of(messageVersion(stringAt(raw, "version", where)), stringAt(raw, "text", where));
  if (!text.ok) throw new ConfigError(VARIABLE, `texts[${index}] ${text.error.message}`);
  return { key: { family, locale, voice }, text: text.value };
}

const isVoice = (value: string): value is Voice => (VOICES as readonly string[]).includes(value);

function stringAt(raw: Record<string, unknown>, field: string, where: string): string {
  const value = raw[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ConfigError(VARIABLE, `${where}.${field} must be a non-empty string`);
  }
  return value;
}
