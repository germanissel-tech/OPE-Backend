// What the gate judges since feature 027: candidates with the text they would be said with. A
// family without a text is not a candidate (01 §322), so the gate only ever sees sayable ones —
// this helper stands in for the corpus in a test that is about the gate and not about the texts.
import { readFileSync } from "node:fs";
import { readCorpus } from "../../src/composition/corpus-config.js";
import { TextVersion } from "../../src/domain/messages/index.js";
import { asOperatorId } from "../../src/domain/operator/index.js";
import type { Candidate, Sayable } from "../../src/domain/selection/index.js";

export const sayable = (candidates: readonly Candidate[]): readonly Sayable[] =>
  candidates.map((candidate) => ({
    candidate,
    said: { messageVersionId: `mv_${candidate.candidateId}_test`, text: "A curated text." },
  }));

/** The seed as it will be in force after the boot: every text as version 1 of its key in the base layer. */
const seeded = (): readonly TextVersion[] =>
  readCorpus({}, (file) => readFileSync(file, "utf8")).map((entry) =>
    TextVersion.numbered(
      {
        key: entry.key,
        text: entry.text,
        corrective: false,
        publishedAt: SEEDED_AT,
        operatorId: asOperatorId("system"),
      },
      1,
    ),
  );

const SEEDED_AT = new Date(0);

/**
 * The version and the text the release ships for a family, in the language it is complete in. The
 * identifier is minted by the domain's own rule (feature 038), never copied: a test that spelled it out
 * would break the day the rule changes without saying what it was checking.
 */
export const corpusEntryOf = (family: string, locale = "es"): { version: string; text: string } => {
  const entry = seeded().find((version) => version.key.family === family && version.key.locale === locale);
  if (entry?.text === undefined) throw new Error(`no curated text for ${family} in ${locale}`);
  return { version: entry.messageVersionId(), text: entry.text.value };
};

/**
 * The text the release ships for a version. A test that copies the corpus into an expectation
 * duplicates it and breaks the day someone improves the wording; what matters is that what reached
 * the SDK is the curated text of that version, and nothing else.
 */
export const corpusText = (version: string): string => {
  const entry = seeded().find((candidate) => candidate.messageVersionId() === version);
  if (entry?.text === undefined) throw new Error(`no curated text for ${version}`);
  return entry.text.value;
};
