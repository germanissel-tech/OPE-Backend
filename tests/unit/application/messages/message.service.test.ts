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
import { AttributeLabels, CuratedText, messageVersion } from "../../../../src/domain/messages/index.js";
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
    const found = entries.find(
      (entry) =>
        entry.family === key.family &&
        entry.locale === key.locale &&
        entry.attributeValue === key.attributeValue,
    );
    if (found === undefined) return Promise.resolve(undefined);
    const version = `mv_${found.family}_${found.attributeValue ?? "any"}_${found.locale}`;
    const text = CuratedText.of(messageVersion(version), found.text);
    if (!text.ok) throw new Error(found.text);
    return Promise.resolve(text.value);
  },
});

const directoryOf = (settings: Partial<MessageSettings> = {}): MessageDirectory => ({
  settingsFor: () => Promise.resolve({ voice: "neutral", labels: AttributeLabels.empty(), ...settings }),
});

const ask = (corpus: MessageCorpus, directory: MessageDirectory, locale?: string) =>
  new Messages({ corpus, directory }).sayable({
    merchantId: MERCHANT,
    candidates: CANDIDATES.fit,
    attributes: new Map(),
    ...(locale === undefined ? {} : { locale }),
  });

const family = (candidate: (typeof CANDIDATES.fit)[number]) => candidate.candidateId;
const uncertainty = rung("uncertainty");

/** What a merchant declared about its own labels: three ways of writing one value of OPE's. */
const labelsOf = (records: readonly { label: string; value: string }[]) => {
  const built = AttributeLabels.of(records);
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
};

// The case that decided the scope of the feature (German Issel, 2026-09-24): a plain white t-shirt
// and one of combed cotton have to say different things, **without anyone writing a text per
// garment**. What differs is the value of an attribute; what is written is one sentence per value.
describe("Messages.sayable — what the product is made of", () => {
  const withMaterial = (material?: string) => new Map(material === undefined ? [] : [["material", material]]);
  const corpus = corpusOf([
    {
      family: family(uncertainty),
      attributeValue: "combed-cotton",
      locale: "es",
      voice: "neutral",
      text: "The combed cotton text.",
    },
    {
      family: family(uncertainty),
      attributeValue: "linen",
      locale: "es",
      voice: "neutral",
      text: "The linen text.",
    },
  ]);
  const labels = labelsOf([
    { label: "Combed Cotton 24/1", value: "combed-cotton" },
    { label: "peinado", value: "combed-cotton" },
    { label: "Linen 100%", value: "linen" },
  ]);
  const askFor = (material?: string) =>
    new Messages({ corpus, directory: directoryOf({ labels }) }).sayable({
      merchantId: MERCHANT,
      candidates: [uncertainty],
      attributes: withMaterial(material),
      locale: "es",
    });

  it("two products differing only in their material say different things", async () => {
    expect((await askFor("Combed Cotton 24/1"))[0]?.said.text).toBe("The combed cotton text.");
    expect((await askFor("Linen 100%"))[0]?.said.text).toBe("The linen text.");
  });

  it("two labels of the merchant meaning one value say the same thing: one sentence, many stores", async () => {
    expect((await askFor("peinado"))[0]?.said.text).toBe("The combed cotton text.");
  });

  it("a product that carries no material does not speak of it", async () => {
    expect(await askFor()).toEqual([]);
  });

  it("a family that claims the material never falls back to a text without it", async () => {
    // A corpus that also holds a text of this family with **no** attribute value: that is what a
    // careless corpus looks like, and it is the only thing between OPE and talking about a fabric it
    // knows nothing about. What decides is the claim of the candidate, not what the corpus answers.
    const careless = corpusOf([
      { family: family(uncertainty), locale: "es", voice: "neutral", text: "The text with no material." },
    ]);
    const said = await new Messages({ corpus: careless, directory: directoryOf({ labels }) }).sayable({
      merchantId: MERCHANT,
      candidates: [uncertainty],
      attributes: withMaterial(),
      locale: "es",
    });
    expect(said).toEqual([]);
  });

  it("a label the merchant mapped to nothing is like no material at all, and is never shown", async () => {
    const said = await askFor("Premium unbeatable cotton");
    expect(said).toEqual([]);
    expect(JSON.stringify(said)).not.toContain("Premium");
  });

  it("a mapped value OPE wrote nothing for does not speak either: the corpus decides, not the merchant", async () => {
    // `denim` is in OPE's vocabulary and this corpus has no sentence for it.
    const denim = labelsOf([{ label: "Denim 12oz", value: "denim" }]);
    const said = await new Messages({ corpus, directory: directoryOf({ labels: denim }) }).sayable({
      merchantId: MERCHANT,
      candidates: [uncertainty],
      attributes: withMaterial("Denim 12oz"),
      locale: "es",
    });
    expect(said).toEqual([]);
  });

  it("adding products costs nothing: twenty of an already mapped material all speak", async () => {
    const all = await Promise.all(Array.from({ length: 20 }, () => askFor("Combed Cotton 24/1")));
    expect(all.every((said) => said[0]?.said.text === "The combed cotton text.")).toBe(true);
  });
});

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
    expect(said[0]?.said.messageVersionId).toBe(`mv_${family(information)}_any_es`);
  });
});
