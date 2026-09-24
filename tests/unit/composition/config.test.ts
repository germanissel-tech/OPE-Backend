// Configuration is read once, at the entry, and either yields a complete AppConfig or refuses
// with the variable and the problem: no NaN port, no half-parsed merchants (fail-closed).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, readConfig } from "../../../src/composition/config.js";
import { EXPERIMENT_STATUSES } from "../../../src/domain/experiment/index.js";
import { testLevels } from "../../helpers/test-app.js";

/** The files of the release are the only reads the configuration makes unless a variable names another. */
const LEVEL_FILES = ["config/platform.json", "config/treatment-defaults.json"].map((f) => path.resolve(f));
const noFile = (file: string): string => {
  if (LEVEL_FILES.includes(file)) return readFileSync(file, "utf8");
  throw new Error(`unexpected read of ${file}`);
};
const merchant = { merchantId: "m_a", ingestKeys: ["k1"], origins: ["https://a.example"] };
/** An experiment of the seed: the treatment share and the target sample are required (no default, constitution XI). */
const exp = {
  experimentId: "exp_00000001",
  treatmentShare: 0.5,
  seed: "s",
  status: "active",
  openedAt: "2026-09-17T00:00:00Z",
  targetSample: 1000,
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
        holdoutShare: 1.2,
      }),
    };
    const read = (file: string): string => files[file] ?? noFile(file);
    expect(readConfig({ OPE_PLATFORM_CONFIG: "p.json" }, read).levels.platform.version).toBe("platform-2");
    expect(() => readConfig({ OPE_TREATMENT_DEFAULTS: "d.json" }, read)).toThrow(
      "treatmentDefaults.holdoutShare is invalid (must be a fraction between 0 and 1).",
    );
    // Feature 023: in range, but finer than a bucket of the split. The server does not start with a
    // holdout that keeps nobody out while the file says otherwise.
    files[path.resolve("d.json")] = JSON.stringify({
      ...testLevels().defaults.record(),
      holdoutShare: 0.004,
    });
    expect(() => readConfig({ OPE_TREATMENT_DEFAULTS: "d.json" }, read)).toThrow(
      "treatmentDefaults.holdoutShare is invalid (must be one of the buckets the assignment splits the visitors into).",
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

  it("experiments are optional, the treatment share is required, and the shape is validated", () => {
    const withExp = { ...merchant, experiments: [exp] };
    const parsed = readConfig({ OPE_MERCHANTS: JSON.stringify([withExp]) }, noFile).merchants[0];
    // A seed declared active was opened, activated and its window started at the same instant.
    expect(parsed?.experiments.all().map((e) => e.record())).toEqual([
      {
        experimentId: exp.experimentId,
        merchantId: "m_a",
        treatmentShare: 0.5,
        seed: exp.seed,
        targetSample: 1000,
        cuts: [],
        status: "active",
        openedAt: new Date(exp.openedAt),
        activatedAt: new Date(exp.openedAt),
        windowStartedAt: new Date(exp.openedAt),
        closedAt: undefined,
        windowRestarts: [],
      },
    ]);
    const calibrating = readConfig(
      {
        OPE_MERCHANTS: JSON.stringify([
          { ...merchant, experiments: [{ ...exp, status: "calibrating", cuts: [0.33, 0.66] }] },
        ]),
      },
      noFile,
    ).merchants[0]?.experiments.all()[0];
    expect(calibrating?.record()).toMatchObject({
      status: "calibrating",
      activatedAt: undefined,
      cuts: [0.33, 0.66],
    });
    expect(
      readConfig({ OPE_MERCHANTS: JSON.stringify([merchant]) }, noFile).merchants[0]?.experiments.all(),
    ).toEqual([]);
    const closed = { ...exp, experimentId: "exp_00000002", status: "closed", treatmentShare: 0.2 };
    const two = { ...merchant, experiments: [closed, exp] };
    const set = readConfig({ OPE_MERCHANTS: JSON.stringify([two]) }, noFile).merchants[0]?.experiments;
    expect(set?.all()).toHaveLength(2);
    expect(set?.open()?.experimentId).toBe(exp.experimentId);
    expect(set?.all()[0]?.record()).toMatchObject({ status: "closed", closedAt: new Date(exp.openedAt) });
    const { treatmentShare, ...noShare } = exp;
    expect(treatmentShare).toBe(0.5);
    expect(() =>
      readConfig({ OPE_MERCHANTS: JSON.stringify([{ ...merchant, experiments: [noShare] }]) }, noFile),
    ).toThrow("merchants[0].experiments[0].treatmentShare must be a number.");
  });

  it.each([
    [
      [{ ...exp }, { ...exp, experimentId: "exp_00000002" }],
      "merchants[0].experiments[1] is invalid (A merchant may have at most one open experiment.)",
    ],
    [[{ ...exp, experimentId: "bad id" }], "merchants[0].experiments[0].experimentId must match"],
    [
      [
        {
          ...exp,
          treatmentShare: 1.01,
        },
      ],
      "merchants[0].experiments[0].treatmentShare is invalid (The treatment share must be a number between 0 and 1.)",
    ],
    [
      [
        {
          ...exp,
          treatmentShare: -0.01,
        },
      ],
      "merchants[0].experiments[0].treatmentShare",
    ],
    // Feature 023: in range, but finer than a bucket — it would open an experiment that assigns
    // nobody, so the seed does not start the server.
    [
      [{ ...exp, treatmentShare: 0.004 }],
      "merchants[0].experiments[0].treatmentShare is invalid (The treatment share must be one of the buckets the assignment splits the visitors into.)",
    ],
    [
      [{ ...exp, seed: "" }],
      "merchants[0].experiments[0].seed is invalid (The seed must be a non-empty string.)",
    ],
    [
      [{ ...exp, status: "paused" }],
      "merchants[0].experiments[0].status must be one of calibrating, active, closed.",
    ],
    [
      [{ ...exp, openedAt: "yesterday" }],
      "merchants[0].experiments[0].openedAt must be an RFC 3339 date-time.",
    ],
    [[{ ...exp, targetSample: "many" }], "merchants[0].experiments[0].targetSample must be a number."],
    [
      [{ ...exp, targetSample: 0 }],
      "merchants[0].experiments[0].targetSample is invalid (The target sample must be an integer of at least 1.)",
    ],
    [[{ ...exp, cuts: "33" }], "merchants[0].experiments[0].cuts must be an array of numbers."],
    [
      [{ ...exp, cuts: [0.66, 0.33] }],
      "merchants[0].experiments[0].cuts[1] is invalid (The cuts must be strictly increasing fractions of the target sample.)",
    ],
    ["nope", "merchants[0].experiments must be an array of experiments."],
  ])("experiments=%j is refused: %s", (experiments, message) => {
    const raw = JSON.stringify([{ ...merchant, experiments }]);
    expect(() => readConfig({ OPE_MERCHANTS: raw }, noFile)).toThrow(ConfigError);
    expect(() => readConfig({ OPE_MERCHANTS: raw }, noFile)).toThrow(message);
  });

  // Feature 022, US3: the reader does not write the states down again. If the domain adds one, the
  // message names it without anybody editing this file, and a state the domain declares is accepted.
  it("the states the seed accepts are the ones the domain declares, and so is the message", () => {
    const listed = EXPERIMENT_STATUSES.join(", ");
    expect(() =>
      readConfig(
        { OPE_MERCHANTS: JSON.stringify([{ ...merchant, experiments: [{ ...exp, status: "paused" }] }]) },
        noFile,
      ),
    ).toThrow(`must be one of ${listed}`);
    for (const status of EXPERIMENT_STATUSES) {
      const raw = JSON.stringify([{ ...merchant, experiments: [{ ...exp, status }] }]);
      expect(readConfig({ OPE_MERCHANTS: raw }, noFile).merchants[0]?.experiments.all(), status).toHaveLength(
        1,
      );
    }
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
    maxIncentiveShare: 0.15,
    incentiveLadderShare: [0.05, 0.1, 0.15],
    marginShare: 0.4,
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
            commercialPolicy: { version: "c-1", marginShare: 0.4 },
            evidenceProfile: { returnsPolicy: true, authorizedAttributes: ["material"] },
            holdoutShare: 0,
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
      commercialPolicy: { version: "c-1", marginShare: 0.4 },
      evidenceProfile: { returnsPolicy: true, authorizedAttributes: ["material"] },
      holdoutShare: 0,
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
      { commercialPolicy: { ...commercial, incentiveLadderShare: ["5"] } },
      "merchants[0].commercialPolicy.incentiveLadderShare[0] is invalid (must be a number).",
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
      { commercialPolicy: { version: "c", incentiveLadderShare: 0.05 } },
      "merchants[0].commercialPolicy.incentiveLadderShare is invalid (must be an array of numbers).",
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
