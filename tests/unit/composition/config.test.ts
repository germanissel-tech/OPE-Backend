// Configuration is read once, at the entry, and either yields a complete AppConfig or refuses
// with the variable and the problem: no NaN port, no half-parsed merchants (fail-closed).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, readConfig } from "../../../src/composition/config.js";
import { testLevels } from "../../helpers/test-app.js";

/** The files of the release are the only reads the configuration makes unless a variable names another. */
const LEVEL_FILES = ["config/platform.json", "config/treatment-defaults.json"].map((f) => path.resolve(f));
const noFile = (file: string): string => {
  if (LEVEL_FILES.includes(file)) return readFileSync(file, "utf8");
  throw new Error(`unexpected read of ${file}`);
};
const merchant = { merchantId: "m_a", ingestKeys: ["k1"], origins: ["https://a.example"] };
/** An experiment of the seed: the treatment percent is required (no default, constitution XI). */
const exp = {
  experimentId: "exp_00000001",
  treatmentPercent: 50,
  seed: "s",
  status: "active",
  startedAt: "2026-09-17T00:00:00Z",
};

describe("readConfig", () => {
  it("defaults: port 3000, loopback host, the bundled contract, no merchants", () => {
    expect(readConfig({}, noFile)).toEqual({
      port: 3000,
      host: "127.0.0.1",
      contractPath: path.resolve("contracts/dist/openapi.yaml"),
      merchants: [],
      operators: [],
      levels: testLevels(),
    });
  });

  it("the levels of the release come from OPE_PLATFORM_CONFIG and OPE_TREATMENT_DEFAULTS, or the files of the repository; a bad value names the level and the field", () => {
    const files: Record<string, string> = {
      [path.resolve("p.json")]: JSON.stringify({ ...testLevels().platform.record(), version: "platform-2" }),
      [path.resolve("d.json")]: JSON.stringify({
        ...testLevels().defaults.record(),
        version: "defaults-2",
        holdoutPercent: 120,
      }),
    };
    const read = (file: string): string => files[file] ?? noFile(file);
    expect(readConfig({ OPE_PLATFORM_CONFIG: "p.json" }, read).levels.platform.version).toBe("platform-2");
    expect(() => readConfig({ OPE_TREATMENT_DEFAULTS: "d.json" }, read)).toThrow(
      "treatmentDefaults.holdoutPercent is invalid (must be an integer percentage between 0 and 100).",
    );
    files[path.resolve("p.json")] = JSON.stringify({
      ...testLevels().platform.record(),
      sessionWindowMs: "1d",
    });
    expect(() => readConfig({ OPE_PLATFORM_CONFIG: "p.json" }, read)).toThrow(
      "platform.sessionWindowMs is invalid (must be a number).",
    );
    files[path.resolve("p.json")] = "{nope";
    expect(() => readConfig({ OPE_PLATFORM_CONFIG: "p.json" }, read)).toThrow(
      "OPE_PLATFORM_CONFIG is not valid JSON (",
    );
  });

  it("reads PORT, HOST and OPE_CONTRACT; a blank variable counts as unset", () => {
    const config = readConfig({ PORT: " 8080 ", HOST: "0.0.0.0", OPE_CONTRACT: "x/openapi.yaml" }, noFile);
    expect(config).toMatchObject({
      port: 8080,
      host: "0.0.0.0",
      contractPath: path.resolve("x/openapi.yaml"),
    });
    expect(readConfig({ PORT: "", HOST: "  ", OPE_CONTRACT: "" }, noFile)).toMatchObject({
      port: 3000,
      host: "127.0.0.1",
      contractPath: path.resolve("contracts/dist/openapi.yaml"),
    });
  });

  it.each(["abc", "3000.5", "-1", "65536", "0x10"])("PORT=%s is refused by name, with the value", (raw) => {
    expect(() => readConfig({ PORT: raw }, noFile)).toThrow(ConfigError);
    expect(() => readConfig({ PORT: raw }, noFile)).toThrow(
      `PORT must be an integer between 0 and 65535, got "${raw}".`,
    );
  });

  it("PORT=0 (a free port, for tests) and 65535 are valid", () => {
    expect(readConfig({ PORT: "0" }, noFile).port).toBe(0);
    expect(readConfig({ PORT: "65535" }, noFile).port).toBe(65535);
  });

  it("merchants come inline from OPE_MERCHANTS or from OPE_MERCHANTS_FILE, inline first", () => {
    const inline = readConfig({ OPE_MERCHANTS: JSON.stringify([merchant]) }, noFile).merchants;
    expect(inline).toHaveLength(1);
    expect(inline[0]?.merchantId).toBe("m_a");
    expect(inline[0]?.seed).toMatchObject({
      merchantId: "m_a",
      ingestKeys: ["k1"],
      origins: ["https://a.example"],
      platformKeys: [],
      platformSecrets: [],
    });
    expect(inline[0]?.experiments.all()).toEqual([]);
    const read = (file: string): string => {
      if (file !== path.resolve("config/m.json")) return noFile(file);
      return JSON.stringify([merchant, { ...merchant, merchantId: "m_b" }]);
    };
    expect(readConfig({ OPE_MERCHANTS_FILE: "config/m.json" }, read).merchants).toHaveLength(2);
    expect(
      readConfig({ OPE_MERCHANTS: "[]", OPE_MERCHANTS_FILE: "config/m.json" }, noFile).merchants,
    ).toEqual([]);
  });

  it("experiments are optional, the treatment percent is required, and the shape is validated", () => {
    const withExp = { ...merchant, experiments: [exp] };
    const parsed = readConfig({ OPE_MERCHANTS: JSON.stringify([withExp]) }, noFile).merchants[0];
    expect(parsed?.experiments.all()).toEqual([
      {
        experimentId: exp.experimentId,
        merchantId: "m_a",
        treatmentShare: 0.5,
        seed: exp.seed,
        status: exp.status,
        startedAt: new Date(exp.startedAt),
      },
    ]);
    expect(
      readConfig({ OPE_MERCHANTS: JSON.stringify([merchant]) }, noFile).merchants[0]?.experiments.all(),
    ).toEqual([]);
    const closed = { ...exp, experimentId: "exp_00000002", status: "closed", treatmentPercent: 20 };
    const two = { ...merchant, experiments: [closed, exp] };
    const set = readConfig({ OPE_MERCHANTS: JSON.stringify([two]) }, noFile).merchants[0]?.experiments;
    expect(set?.all()).toHaveLength(2);
    expect(set?.active()?.experimentId).toBe(exp.experimentId);
    const { treatmentPercent, ...noPercent } = exp;
    expect(treatmentPercent).toBe(50);
    expect(() =>
      readConfig({ OPE_MERCHANTS: JSON.stringify([{ ...merchant, experiments: [noPercent] }]) }, noFile),
    ).toThrow("merchants[0].experiments[0].treatmentPercent must be an integer percentage.");
  });

  it.each([
    [
      [{ ...exp }, { ...exp, experimentId: "exp_00000002" }],
      "merchants[0].experiments[1] is invalid (A merchant may have at most one active experiment.)",
    ],
    [[{ ...exp, experimentId: "bad id" }], "merchants[0].experiments[0].experimentId must match"],
    [
      [
        {
          experimentId: "exp_00000001",
          seed: "s",
          status: "active",
          startedAt: "2026-09-17T00:00:00Z",
          treatmentPercent: 101,
        },
      ],
      "merchants[0].experiments[0].treatmentPercent is invalid (The treatment share must be a number between 0 and 1.)",
    ],
    [
      [
        {
          experimentId: "exp_00000001",
          seed: "s",
          status: "active",
          startedAt: "2026-09-17T00:00:00Z",
          treatmentPercent: -1,
        },
      ],
      "merchants[0].experiments[0].treatmentPercent",
    ],
    [
      [
        {
          experimentId: "exp_00000001",
          seed: "s",
          status: "active",
          startedAt: "2026-09-17T00:00:00Z",
          treatmentPercent: 12.5,
        },
      ],
      "merchants[0].experiments[0].treatmentPercent",
    ],
    [
      [{ ...exp, seed: "" }],
      "merchants[0].experiments[0].seed is invalid (The seed must be a non-empty string.)",
    ],
    [[{ ...exp, status: "paused" }], "merchants[0].experiments[0].status must be one of active, closed."],
    [
      [{ ...exp, startedAt: "yesterday" }],
      "merchants[0].experiments[0].startedAt must be an RFC 3339 date-time.",
    ],
    ["nope", "merchants[0].experiments must be an array of experiments."],
  ])("experiments=%j is refused: %s", (experiments, message) => {
    const raw = JSON.stringify([{ ...merchant, experiments }]);
    expect(() => readConfig({ OPE_MERCHANTS: raw }, noFile)).toThrow(ConfigError);
    expect(() => readConfig({ OPE_MERCHANTS: raw }, noFile)).toThrow(message);
  });

  const policy = {
    version: "sport-2",
    threshold: 0.6,
    priority: ["returns", "fit", "price"],
    evidence: { freshStockAndPrice: ["price"], availableVariant: ["fit"] },
    rules: [
      {
        id: "price.cta",
        barrier: "price",
        strength: "supporting",
        weight: 0.25,
        when: { fact: "eventCount", type: "cta_approached", min: 1 },
      },
      {
        id: "returns.any-doubt",
        barrier: "returns",
        strength: "strong",
        when: {
          any: [{ fact: "returnedToProduct" }, { not: { fact: "sessionAddedToCart" } }, { all: [] }],
        },
      },
    ],
  };
  const commercial = {
    version: "sport-commercial-1",
    maxIncentivePercent: 15,
    incentiveLadderPercent: [5, 10, 15],
    marginPercent: 40,
    directIncentiveOnPrice: false,
    returnRisk: { fact: "sessionAddedToCart" },
    highIntent: "from-cart",
    abandonment: "nothing",
    interventionsPerSession: 2,
    cooldownSeconds: 30,
    interventionsPerVisitorPerDay: 5,
  };

  it("what the merchant declares of its configuration is read by shape into its version 1 (feature 017): the values are judged at the import", () => {
    expect(readConfig({ OPE_MERCHANTS: JSON.stringify([merchant]) }, noFile).merchants[0]?.declared).toEqual(
      {},
    );
    const declared = readConfig(
      {
        OPE_MERCHANTS: JSON.stringify([
          {
            ...merchant,
            decisionPolicy: policy,
            commercialPolicy: { version: "c-1", marginPercent: 40 },
            evidenceProfile: { returnsPolicy: true, authorizedAttributes: ["material"] },
            holdoutPercent: 0,
            freshness: { stockAndPriceMs: 600000 },
            locales: { supported: ["es-AR"], fallback: "es-AR" },
            anchors: { price: { selectors: [".price"] } },
          },
        ]),
      },
      noFile,
    ).merchants[0]?.declared;
    expect(declared).toEqual({
      decisionPolicy: policy,
      commercialPolicy: { version: "c-1", marginPercent: 40 },
      evidenceProfile: { returnsPolicy: true, authorizedAttributes: ["material"] },
      holdoutPercent: 0,
      freshness: { stockAndPriceMs: 600000 },
      locales: { supported: ["es-AR"], fallback: "es-AR" },
      anchors: { price: { selectors: [".price"] } },
    });
  });

  it.each<[string, Record<string, unknown>, string]>([
    [
      "decisionPolicy not an object",
      { decisionPolicy: "x" },
      "merchants[0].decisionPolicy is invalid (is not an object).",
    ],
    [
      "decisionPolicy without version",
      { decisionPolicy: { ...policy, version: undefined } },
      "merchants[0].decisionPolicy.version is invalid (is required).",
    ],
    [
      "a rule condition with an unknown fact",
      { decisionPolicy: { ...policy, rules: [{ ...policy.rules[0], when: { fact: "socialProof" } }] } },
      "merchants[0].decisionPolicy.rules[0].when.fact is invalid (must be one of eventCount, dwellSeconds, sequence, productAttribute, returnedToProduct, variantAvailable, sessionAddedToCart, sessionEnteredCheckout).",
    ],
    [
      "a condition inside a combinator with a wrong shape",
      {
        decisionPolicy: {
          ...policy,
          rules: [{ ...policy.rules[0], when: { all: [{ fact: "dwellSeconds", block: 3 }] } }],
        },
      },
      "merchants[0].decisionPolicy.rules[0].when.all[0].block is invalid (must be a string).",
    ],
    [
      "highIntent, moved to the commercial policy",
      { decisionPolicy: { ...policy, highIntent: "from-checkout" } },
      "merchants[0].decisionPolicy.highIntent is invalid (is not a field of this object).",
    ],
    [
      "commercial not an object",
      { commercialPolicy: 3 },
      "merchants[0].commercialPolicy is invalid (is not an object).",
    ],
    [
      "commercial without version",
      { commercialPolicy: {} },
      "merchants[0].commercialPolicy.version is invalid (is required).",
    ],
    [
      "ladder not numbers",
      { commercialPolicy: { ...commercial, incentiveLadderPercent: ["5"] } },
      "merchants[0].commercialPolicy.incentiveLadderPercent[0] is invalid (must be a number).",
    ],
    [
      "highIntent outside the vocabulary",
      { commercialPolicy: { ...commercial, highIntent: "always" } },
      "merchants[0].commercialPolicy.highIntent is invalid (must be one of from-cart, from-checkout, never).",
    ],
    [
      "evidenceProfile with a wrong type",
      { evidenceProfile: { returnsPolicy: "yes" } },
      "merchants[0].evidenceProfile.returnsPolicy is invalid (must be a boolean).",
    ],
    ["locales without the list", { locales: {} }, "merchants[0].locales.supported is invalid (is required)."],
    [
      "a fact with a field it does not have",
      {
        decisionPolicy: {
          ...policy,
          rules: [{ ...policy.rules[0], when: { fact: "returnedToProduct", min: 2 } }],
        },
      },
      "merchants[0].decisionPolicy.rules[0].when.min is invalid (is not a field of this object).",
    ],
    [
      "a ladder that is not a list",
      { commercialPolicy: { version: "c", incentiveLadderPercent: 5 } },
      "merchants[0].commercialPolicy.incentiveLadderPercent is invalid (must be an array of numbers).",
    ],
    [
      "rules that are not a list",
      { decisionPolicy: { version: "d", rules: "none" } },
      "merchants[0].decisionPolicy.rules is invalid (must be an array).",
    ],
    [
      "anchors with a field that is not selectors",
      { anchors: { price: { selectors: [".p"], weight: 1 } } },
      "merchants[0].anchors.price.weight is invalid (is not a field of this object).",
    ],
    [
      "an evidence profile whose attributes are not all strings",
      { evidenceProfile: { authorizedAttributes: ["material", 3] } },
      "merchants[0].evidenceProfile.authorizedAttributes is invalid (must be an array of strings).",
    ],
    [
      "anchors with a bad selector list",
      { anchors: { price: { selectors: "x" } } },
      "merchants[0].anchors.price.selectors is invalid (must be an array of strings).",
    ],
  ])("the declared configuration: %s is refused naming the field", (_name, over, message) => {
    const raw = JSON.stringify([{ ...merchant, ...over }]);
    expect(() => readConfig({ OPE_MERCHANTS: raw }, noFile)).toThrow(ConfigError);
    expect(() => readConfig({ OPE_MERCHANTS: raw }, noFile)).toThrow(message);
  });

  it.each([
    ["{not json", "OPE_MERCHANTS is not valid JSON ("],
    ['{"merchantId":"m"}', "OPE_MERCHANTS must be a JSON array of merchants."],
    ["[1]", "merchants[0] is not an object."],
    [
      '[{"merchantId":"","ingestKeys":["k"],"origins":["o"]}]',
      "merchants[0].merchantId must be a non-empty string.",
    ],
    [
      '[{"merchantId":"m","ingestKeys":"k","origins":["o"]}]',
      "merchants[0].ingestKeys must be an array of strings.",
    ],
    [
      '[{"merchantId":"m","ingestKeys":[],"origins":["https://o.example"]}]',
      "merchants[0].ingestKeys is invalid (A merchant needs one or two non-empty ingest keys.)",
    ],
    [
      '[{"merchantId":"m","ingestKeys":["a","b","c"],"origins":["https://o.example"]}]',
      "merchants[0].ingestKeys is invalid (A merchant needs one or two non-empty ingest keys.)",
    ],
    [
      '[{"merchantId":"m","ingestKeys":["a",""],"origins":["https://o.example"]}]',
      "merchants[0].ingestKeys[1] is invalid (A merchant needs one or two non-empty ingest keys.)",
    ],
    [
      '[{"merchantId":"m","ingestKeys":["k"],"origins":[]}]',
      "merchants[0].origins is invalid (A merchant needs at least one registered origin.)",
    ],
    [
      '[{"merchantId":"m","ingestKeys":["k"],"origins":["https://o.example"],"platformKeys":["a","b","c"]}]',
      "merchants[0].platformKeys is invalid (A merchant has at most two platform keys.)",
    ],
  ])("OPE_MERCHANTS=%s is refused: %s", (raw, message) => {
    expect(() => readConfig({ OPE_MERCHANTS: raw }, noFile)).toThrow(ConfigError);
    expect(() => readConfig({ OPE_MERCHANTS: raw }, noFile)).toThrow(message);
  });

  it("platformSecrets (ADR-029): optional, one or two, kept in the seed; invalid ones name the field", () => {
    const read = (over: Record<string, unknown>) =>
      readConfig({ OPE_MERCHANTS: JSON.stringify([{ ...merchant, platformKeys: ["p1"], ...over }]) }, noFile)
        .merchants[0]?.seed;
    expect(read({})?.platformSecrets).toEqual([]);
    expect(read({ platformSecrets: ["s1", "s2"] })?.platformSecrets).toEqual(["s1", "s2"]);
    expect(() => read({ platformSecrets: "s1" })).toThrow(
      "merchants[0].platformSecrets must be an array of strings",
    );
    expect(() => read({ platformSecrets: ["a", "b", "c"] })).toThrow(
      "merchants[0].platformSecrets is invalid (A merchant has at most two platform signing secrets.)",
    );
    expect(() => read({ platformSecrets: ["s1", ""] })).toThrow("merchants[0].platformSecrets[1] is invalid");
    expect(() => read({ platformSecrets: ["p1"] })).toThrow("merchants[0].platformSecrets[0] is invalid");
  });
});

describe("readConfig — operators (feature 017)", () => {
  const withFile = (content: string) => (file: string) =>
    file.endsWith("ops.json") ? content : noFile(file);

  it("reads OPE_ADMIN_OPERATORS inline or from a file; the token never appears, only fingerprints", () => {
    const raw = JSON.stringify([
      { operatorId: "ops-1", tokenFingerprints: ["f1", "f2"], scope: "*" },
      { operatorId: "ops-a", tokenFingerprints: ["f3"], scope: ["m_a"] },
    ]);
    const inline = readConfig({ OPE_ADMIN_OPERATORS: raw }, noFile).operators;
    expect(inline.map((o) => [o.operatorId, o.scope])).toEqual([
      ["ops-1", "*"],
      ["ops-a", ["m_a"]],
    ]);
    expect(inline[0]?.holds("f2")).toBe(true);
    expect(readConfig({ OPE_ADMIN_OPERATORS_FILE: "ops.json" }, withFile(raw)).operators).toHaveLength(2);
  });

  it.each([
    ["not JSON", "{", "OPE_ADMIN_OPERATORS is not valid JSON"],
    ["not an array", "{}", "OPE_ADMIN_OPERATORS must be a JSON array"],
    ["not an object", "[1]", "operators[0] is not an object"],
    ["no id", JSON.stringify([{ tokenFingerprints: ["f"], scope: "*" }]), "operators[0].operatorId must be"],
    [
      "fingerprints not strings",
      JSON.stringify([{ operatorId: "o", tokenFingerprints: [1], scope: "*" }]),
      "operators[0].tokenFingerprints must be",
    ],
    [
      "no fingerprints",
      JSON.stringify([{ operatorId: "o", tokenFingerprints: [], scope: "*" }]),
      "operators[0].tokenFingerprints is invalid",
    ],
    [
      "blank fingerprint",
      JSON.stringify([{ operatorId: "o", tokenFingerprints: ["f", " "], scope: "*" }]),
      "operators[0].tokenFingerprints[1] is invalid",
    ],
    [
      "scope not * nor list",
      JSON.stringify([{ operatorId: "o", tokenFingerprints: ["f"], scope: "all" }]),
      "operators[0].scope must be",
    ],
    [
      "empty merchant in scope",
      JSON.stringify([{ operatorId: "o", tokenFingerprints: ["f"], scope: ["m_a", ""] }]),
      "operators[0].scope[1] is invalid",
    ],
  ])("%s → ConfigError naming the field", (_name, raw, message) => {
    expect(() => readConfig({ OPE_ADMIN_OPERATORS: raw }, noFile)).toThrow(ConfigError);
    expect(() => readConfig({ OPE_ADMIN_OPERATORS: raw }, noFile)).toThrow(message);
  });
});
