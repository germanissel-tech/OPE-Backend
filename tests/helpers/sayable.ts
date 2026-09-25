// What the gate judges since feature 027: candidates with the text they would be said with. A
// family without a text is not a candidate (01 §322), so the gate only ever sees sayable ones —
// this helper stands in for the corpus in a test that is about the gate and not about the texts.
import { readFileSync } from "node:fs";
import { readCorpus } from "../../src/composition/corpus-config.js";
import type { Candidate, Sayable } from "../../src/domain/selection/index.js";

export const sayable = (candidates: readonly Candidate[]): readonly Sayable[] =>
  candidates.map((candidate) => ({
    candidate,
    said: { messageVersionId: `mv_${candidate.candidateId}_test`, text: "A curated text." },
  }));

/** The version and the text the release ships for a family, in the language it is complete in. */
export const corpusEntryOf = (family: string, locale = "es"): { version: string; text: string } => {
  const entry = readCorpus({}, (file) => readFileSync(file, "utf8"), "es").find(
    (candidate) => candidate.key.family === family && candidate.key.locale === locale,
  );
  if (entry === undefined) throw new Error(`no curated text for ${family} in ${locale}`);
  return { version: entry.text.version, text: entry.text.value };
};

/**
 * The text the release ships for a version. A test that copies the corpus into an expectation
 * duplicates it and breaks the day someone improves the wording; what matters is that what reached
 * the SDK is the curated text of that version, and nothing else.
 */
export const corpusText = (version: string): string => {
  const entry = readCorpus({}, (file) => readFileSync(file, "utf8"), "es").find(
    (candidate) => candidate.text.version === version,
  );
  if (entry === undefined) throw new Error(`no curated text for ${version}`);
  return entry.text.value;
};
