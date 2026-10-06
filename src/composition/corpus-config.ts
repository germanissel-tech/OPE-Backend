// The seed of the base texts (feature 027, constitution VIII; a seed since feature 038): the texts a
// person sees, written and reviewed before they are served. The file is read for its **shape** only —
// what a key and a text look like— and nothing more: the vocabulary, the rules of a text and the
// completeness of the base are the domain's, judged when the seed is imported into an empty store
// (`ImportTextsUseCase`), and never again at boot. From the second boot on, what is in force is what an
// operator published and editing this file does nothing.
import path from "node:path";
import { ConfigError } from "./config-error.js";
import { parseJson, text } from "./env.js";
import type { SeedText } from "../application/messages/index.js";

/** The file of the release that holds the seed. */
const CORPUS_FILE = "config/messages.json";

const VARIABLE = "OPE_MESSAGE_CORPUS";

const FAMILY = "family";
const ATTRIBUTE_VALUE = "attributeValue";
const LOCALE = "locale";
const TEXT = "text";

/** The fields a seed text may carry; anything else —a `voice`, a declared `version`— is a file of another release. */
const FIELDS: ReadonlySet<string> = new Set([FAMILY, ATTRIBUTE_VALUE, LOCALE, TEXT]);

/** `OPE_MESSAGE_CORPUS` names the file; the one of the repository otherwise. */
export function readCorpus(env: NodeJS.ProcessEnv, readFile: (file: string) => string): readonly SeedText[] {
  const raw = parseJson(VARIABLE, readFile(path.resolve(text(env, VARIABLE) ?? CORPUS_FILE)));
  const texts = isObject(raw) ? raw["texts"] : undefined;
  if (!Array.isArray(texts)) throw new ConfigError(VARIABLE, "must hold a list of texts");
  return texts.map((entry, index) => entryOf(entry, index));
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function entryOf(raw: unknown, index: number): SeedText {
  const where = `texts[${index}]`;
  if (!isObject(raw)) throw new ConfigError(VARIABLE, `${where} is not an object`);
  // A field this release does not know is almost always a seed of the previous one: the voice left in
  // feature 038, and the per-text version is minted by the store since then.
  const stranger = Object.keys(raw).find((field) => !FIELDS.has(field));
  if (stranger !== undefined)
    throw new ConfigError(VARIABLE, `${where}.${stranger} is not a field of a seed text`);
  const family = fieldAt(raw, FAMILY, where);
  const locale = fieldAt(raw, LOCALE, where);
  const value = fieldAt(raw, TEXT, where);
  const attributeValue = raw[ATTRIBUTE_VALUE];
  if (attributeValue !== undefined && typeof attributeValue !== "string") {
    throw new ConfigError(VARIABLE, `${where}.${ATTRIBUTE_VALUE} must be a string`);
  }
  return {
    key: { family, locale, ...(attributeValue === undefined ? {} : { attributeValue }) },
    text: value,
  };
}

/** A field of the seed: the reader owns its shape; what it means is the domain's. */
function fieldAt(raw: Record<string, unknown>, field: string, where: string): string {
  const value = raw[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ConfigError(VARIABLE, `${where}.${field} must be a non-empty string`);
  }
  return value;
}
