// What can be said, and in which language. The rule that matters is that the language never gives:
// a family without a text in the language resolved stops being a candidate (01 §322) instead of
// being said in another one.
import { describe, expect, it } from "vitest";
import {
  Messages,
  type MessageCorpus,
  type MessageDirectory,
  type MessageSettings,
  type TextKey,
} from "../../../../src/application/messages/index.js";
import { CuratedText, messageVersion } from "../../../../src/domain/messages/index.js";
import { CANDIDATES, type Candidate, type Step } from "../../../../src/domain/selection/index.js";
import type { MerchantId } from "../../../../src/domain/shared-kernel/index.js";

const MERCHANT = "m_a" as MerchantId;
// The texts below are fixtures, not corpus content: this test judges which one is chosen, never
// what it says, so they stay in the language of the code (ADR-015).
/** A candidate of the fit barrier by its rung: naming the step reads better than an index. */
const rung = (step: Step): Candidate => {
  const found = CANDIDATES.fit.find((candidate) => candidate.step === step);
  if (found === undefined) throw new Error(step);
  return found;
};
const information = rung("information");
const reassurance = rung("reassurance");

/** A corpus that holds exactly the entries a test names, and answers nothing else. */
const corpusOf = (entries: readonly (TextKey & { text: string })[]): MessageCorpus => ({
  find: (key: TextKey) => {
    // The voice is not compared: with a single voice the comparison is always true and the
    // compiler says so. It returns to this corpus with the second one.
    const found = entries.find((entry) => entry.family === key.family && entry.locale === key.locale);
    if (found === undefined) return Promise.resolve(undefined);
    const text = CuratedText.of(messageVersion(`mv_${found.family}_${found.locale}`), found.text);
    if (!text.ok) throw new Error(found.text);
    return Promise.resolve(text.value);
  },
});

const directoryOf = (settings: Partial<MessageSettings> = {}): MessageDirectory => ({
  settingsFor: () => Promise.resolve({ voice: "neutral", supported: ["es"], ...settings }),
});

const ask = (corpus: MessageCorpus, directory: MessageDirectory, locale?: string) =>
  new Messages({ corpus, directory }).sayable({
    merchantId: MERCHANT,
    candidates: CANDIDATES.fit,
    attributes: new Map(),
    ...(locale === undefined ? {} : { locale }),
  });

const family = (candidate: (typeof CANDIDATES.fit)[number]) => candidate.candidateId;

describe("Messages.sayable — what can be said", () => {
  it("answers only the families the corpus holds, in the order given (the ladder)", async () => {
    const corpus = corpusOf([
      { family: family(reassurance), locale: "es", voice: "neutral", text: "The reassurance text." },
      { family: family(information), locale: "es", voice: "neutral", text: "The information text." },
    ]);
    const said = await ask(corpus, directoryOf(), "es");
    expect(said.map((s) => s.candidate.step)).toEqual(["information", "reassurance"]);
    expect(said[0]?.said.text).toBe("The information text.");
  });

  it("drops a family the corpus has no text for: it is not a candidate, not a candidate with no text", async () => {
    const corpus = corpusOf([
      { family: family(information), locale: "es", voice: "neutral", text: "The information text." },
    ]);
    const said = await ask(corpus, directoryOf(), "es");
    expect(said).toHaveLength(1);
    expect(said.every((s) => s.said.text.length > 0)).toBe(true);
  });

  it("answers nothing when no family has a text: nothing sayable is an empty answer, not a broken one", async () => {
    expect(await ask(corpusOf([]), directoryOf(), "es")).toEqual([]);
  });

  it("uses the reserve language when the page's has no text, and never a text of another language", async () => {
    const corpus = corpusOf([
      { family: family(information), locale: "es", voice: "neutral", text: "The information text." },
    ]);
    // The page is in Portuguese and the corpus is not: with a reserve language it answers, without
    // one it says nothing — what it never does is answer in Portuguese with the Spanish text.
    expect(await ask(corpus, directoryOf({ fallback: "es" }), "pt-BR")).toHaveLength(1);
    expect(await ask(corpus, directoryOf(), "pt-BR")).toEqual([]);
  });

  it("uses the reserve language when the page declares none", async () => {
    const corpus = corpusOf([
      { family: family(information), locale: "es", voice: "neutral", text: "The information text." },
    ]);
    expect(await ask(corpus, directoryOf({ fallback: "es" }))).toHaveLength(1);
    expect(await ask(corpus, directoryOf())).toEqual([]);
  });

  it("carries the version of the text it found, which is what the ledger keeps", async () => {
    const corpus = corpusOf([
      { family: family(information), locale: "es", voice: "neutral", text: "The information text." },
    ]);
    const said = await ask(corpus, directoryOf(), "es");
    expect(said[0]?.said.messageVersionId).toBe(`mv_${family(information)}_es`);
  });
});
