// The example that fixed the scope of feature 027 (SC-002, SC-003), executable. It is here because
// the numbers are the argument: a shop of twelve garments and seven ways of writing a fabric costs
// OPE four sentences and the shop five lines, and adding products costs nothing at all.
//
// If this test ever needs a text per product to pass, the mechanism went back to what the
// stakeholder discarded on 2026-09-24: a message per garment and per characteristic never ships.
//
// The labels below are in the language of the code, like every fixture: what they prove is that
// three different strings collapse into one value of OPE, not which language a shop writes in.
import { describe, expect, it } from "vitest";
import { Messages, type MessageCorpus, type TextKey } from "../../../../src/application/messages/index.js";
import { AttributeLabels, CuratedText, messageVersion } from "../../../../src/domain/messages/index.js";
import { CANDIDATES, type Candidate } from "../../../../src/domain/selection/index.js";
import type { MerchantId } from "../../../../src/domain/shared-kernel/index.js";

const MERCHANT = "m_a" as MerchantId;
/** The rung that says what the garment is made of; neither a cast nor an assertion, which the lint forbids. */
const rung = (step: string): Candidate => {
  const found = CANDIDATES.fit.find((candidate) => candidate.step === step);
  if (found === undefined) throw new Error(step);
  return found;
};
const uncertainty = rung("uncertainty");

/** The shop: three categories, twelve garments, seven ways of writing what they are made of. */
const SHOP = [
  ["T-shirts", "Plain white", undefined],
  ["T-shirts", "Combed cotton", "Combed Cotton 24/1"],
  ["T-shirts", "Linen", "Linen 100%"],
  ["T-shirts", "Oversize", "Combed Cotton 24/1"],
  ["Trousers", "Straight jeans", "Denim 12oz"],
  ["Trousers", "Stretch jeans", "Stretch denim"],
  ["Trousers", "Linen ones", "Linen 100%"],
  ["Trousers", "Joggers", "Fleece"],
  ["Jackets", "Denim jacket", "Denim 12oz"],
  ["Jackets", "Puffer", "Nylon"],
  ["Jackets", "Linen ones", "Linen 100%"],
  ["Jackets", "Leather one", "Cowhide leather"],
] as const;

/** What OPE writes: one sentence per value of its vocabulary, for every shop that sells it. */
const OPE_WRITES = [
  ["combed-cotton", "The combed cotton sentence."],
  ["linen", "The linen sentence."],
  ["denim", "The denim sentence."],
  ["leather", "The leather sentence."],
] as const;

/** What the shop configures: its own labels translated to OPE's vocabulary. Five lines. */
const SHOP_CONFIGURES = [
  { label: "Combed Cotton 24/1", value: "combed-cotton" },
  { label: "Linen 100%", value: "linen" },
  { label: "Denim 12oz", value: "denim" },
  { label: "Stretch denim", value: "denim" },
  { label: "Cowhide leather", value: "leather" },
];

const corpus: MessageCorpus = {
  find: (key: TextKey) => {
    const found = OPE_WRITES.find(([value]) => value === key.attributeValue);
    if (found === undefined || key.family !== uncertainty.candidateId) return Promise.resolve(undefined);
    const text = CuratedText.of(messageVersion(`mv_${found[0]}_es_neutral_1`), found[1]);
    if (!text.ok) throw new Error(found[1]);
    return Promise.resolve(text.value);
  },
};

const labels = AttributeLabels.of(SHOP_CONFIGURES);
if (!labels.ok) throw new Error(labels.error.message);
const messages = new Messages({
  corpus,
  directory: { settingsFor: () => Promise.resolve({ voice: "neutral", labels: labels.value }) },
});

const whatItSays = async (material: string | undefined) =>
  (
    await messages.sayable({
      merchantId: MERCHANT,
      candidates: [uncertainty],
      attributes: new Map(material === undefined ? [] : [["material", material]]),
      locale: "es",
    })
  )[0]?.said.text;

describe("the worked example: twelve garments, four sentences, five lines", () => {
  it("SC-002: OPE writes four sentences and the shop configures five lines, for twelve garments", () => {
    expect(SHOP).toHaveLength(12);
    expect(new Set(SHOP.map(([, , material]) => material)).size).toBe(8); // seven labels and «none»
    expect(OPE_WRITES).toHaveLength(4);
    expect(SHOP_CONFIGURES).toHaveLength(5);
  });

  it("every garment with a mapped fabric speaks, and the same fabric always says the same thing", async () => {
    const said = await Promise.all(SHOP.map(async ([, , material]) => whatItSays(material)));
    // The three linen garments sit in three different categories and say one thing: the category
    // never took part in the decision, which is why this feature builds no concept of it.
    const linen = [said[2], said[6], said[10]];
    expect(new Set(linen)).toEqual(new Set(["The linen sentence."]));
    expect(said[1]).toBe("The combed cotton sentence.");
    expect(said[3]).toBe("The combed cotton sentence.");
    // Two labels of the shop, one value of OPE, one sentence.
    expect(said[4]).toBe("The denim sentence.");
    expect(said[5]).toBe("The denim sentence.");
  });

  it("the garments whose fabric nobody mapped say nothing about it, and nothing breaks", async () => {
    expect(await whatItSays(undefined)).toBeUndefined(); // the plain white t-shirt
    expect(await whatItSays("Fleece")).toBeUndefined(); // the jogging trousers
    expect(await whatItSays("Nylon")).toBeUndefined(); // the puffer
  });

  it("SC-003: forty more garments of a mapped fabric cost no sentence and no line", async () => {
    const before = { sentences: OPE_WRITES.length, lines: SHOP_CONFIGURES.length };
    const arriving = Array.from({ length: 40 }, () => "Denim 12oz");
    const said = await Promise.all(arriving.map(async (material) => whatItSays(material)));
    expect(said.every((text) => text === "The denim sentence.")).toBe(true);
    expect({ sentences: OPE_WRITES.length, lines: SHOP_CONFIGURES.length }).toEqual(before);
  });
});
