// Configuration is read once, at the entry, and either yields a complete AppConfig or refuses
// with the variable and the problem: no NaN port, no half-parsed merchants (fail-closed).
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, readConfig } from "../../../src/composition/config.js";

const noFile = (file: string): string => {
  throw new Error(`unexpected read of ${file}`);
};
const merchant = { merchantId: "m_a", ingestKeys: ["k1"], origins: ["https://a.example"] };

describe("readConfig", () => {
  it("defaults: port 3000, loopback host, the bundled contract, no merchants", () => {
    expect(readConfig({}, noFile)).toEqual({
      port: 3000,
      host: "127.0.0.1",
      contractPath: path.resolve("contracts/dist/openapi.yaml"),
      merchants: [],
    });
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
    expect(readConfig({ OPE_MERCHANTS: JSON.stringify([merchant]) }, noFile).merchants).toEqual([
      {
        merchant: {
          merchantId: "m_a",
          ingestKeys: ["k1"],
          origins: [{ value: "https://a.example" }],
          platformKeys: [],
        },
        experiments: [],
      },
    ]);
    const read = (file: string): string => {
      expect(file).toBe(path.resolve("config/m.json"));
      return JSON.stringify([merchant, { ...merchant, merchantId: "m_b" }]);
    };
    expect(readConfig({ OPE_MERCHANTS_FILE: "config/m.json" }, read).merchants).toHaveLength(2);
    expect(
      readConfig({ OPE_MERCHANTS: "[]", OPE_MERCHANTS_FILE: "config/m.json" }, noFile).merchants,
    ).toEqual([]);
  });

  it("experiments are optional, treatmentPercent defaults to 50, and the shape is validated", () => {
    const exp = {
      experimentId: "exp_00000001",
      seed: "s",
      status: "active",
      startedAt: "2026-09-17T00:00:00Z",
    };
    const withExp = { ...merchant, experiments: [exp] };
    const parsed = readConfig({ OPE_MERCHANTS: JSON.stringify([withExp]) }, noFile).merchants[0];
    expect(parsed?.experiments).toEqual([
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
      readConfig({ OPE_MERCHANTS: JSON.stringify([merchant]) }, noFile).merchants[0]?.experiments,
    ).toEqual([]);
    const closed = { ...exp, experimentId: "exp_00000002", status: "closed", treatmentPercent: 20 };
    const two = { ...merchant, experiments: [closed, exp] };
    expect(
      readConfig({ OPE_MERCHANTS: JSON.stringify([two]) }, noFile).merchants[0]?.experiments,
    ).toHaveLength(2);
  });

  it.each([
    [
      [
        { experimentId: "exp_00000001", seed: "s", status: "active", startedAt: "2026-09-17T00:00:00Z" },
        { experimentId: "exp_00000002", seed: "s", status: "active", startedAt: "2026-09-17T00:00:00Z" },
      ],
      "merchants[0].experiments must have at most one active experiment.",
    ],
    [
      [{ experimentId: "bad id", seed: "s", status: "active", startedAt: "2026-09-17T00:00:00Z" }],
      "merchants[0].experiments[0].experimentId must match",
    ],
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
      [{ experimentId: "exp_00000001", seed: "", status: "active", startedAt: "2026-09-17T00:00:00Z" }],
      "merchants[0].experiments[0].seed is invalid (The seed must be a non-empty string.)",
    ],
    [
      [{ experimentId: "exp_00000001", seed: "s", status: "paused", startedAt: "2026-09-17T00:00:00Z" }],
      "merchants[0].experiments[0].status must be one of active, closed.",
    ],
    [
      [{ experimentId: "exp_00000001", seed: "s", status: "active", startedAt: "yesterday" }],
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
        id: "fit.size-selector-twice",
        barrier: "fit",
        strength: "strong",
        when: {
          all: [
            { fact: "eventCount", type: "size_selector_interacted", min: 2 },
            { not: { fact: "sessionAddedToCart" } },
          ],
        },
      },
      {
        id: "price.cta",
        barrier: "price",
        strength: "supporting",
        weight: 0.25,
        when: { fact: "eventCount", type: "cta_approached", min: 1 },
      },
      {
        id: "returns.cart-then-policies",
        barrier: "returns",
        strength: "strong",
        when: {
          fact: "sequence",
          first: { type: "added_to_cart" },
          then: { type: "block_dwelled", subtype: "policies" },
        },
      },
    ],
  };

  it("decisionPolicy is optional; a valid one is built with its defaults (weights 0.4/0.2, 5 s)", () => {
    expect(
      readConfig({ OPE_MERCHANTS: JSON.stringify([merchant]) }, noFile).merchants[0]?.decisionPolicy,
    ).toBeUndefined();
    const parsed = readConfig(
      { OPE_MERCHANTS: JSON.stringify([{ ...merchant, decisionPolicy: policy }]) },
      noFile,
    ).merchants[0]?.decisionPolicy;
    expect(parsed?.version).toBe("sport-2");
    expect(parsed?.rules.weights).toEqual({ strong: 0.4, supporting: 0.2 });
    expect(parsed?.rules.readingSeconds).toBe(5);
    expect(parsed?.rules.rules.map((r) => r.id)).toEqual([
      "fit.size-selector-twice",
      "price.cta",
      "returns.cart-then-policies",
    ]);
    expect(parsed?.rules.rules[1]?.weight).toBe(0.25);
    expect(parsed?.evidence).toEqual({ freshStockAndPrice: ["price"], availableVariant: ["fit"] });
    const explicit = { ...policy, weights: { strong: 0.5, supporting: 0.1 }, readingSeconds: 8 };
    const custom = readConfig(
      { OPE_MERCHANTS: JSON.stringify([{ ...merchant, decisionPolicy: explicit }]) },
      noFile,
    ).merchants[0]?.decisionPolicy;
    expect(custom?.rules.weights).toEqual({ strong: 0.5, supporting: 0.1 });
    expect(custom?.rules.readingSeconds).toBe(8);
  });

  it.each<[string, Record<string, unknown>, string]>([
    ["not an object", { decisionPolicy: "x" }, "merchants[0].decisionPolicy is not an object."],
    [
      "version missing",
      { decisionPolicy: { ...policy, version: undefined } },
      "merchants[0].decisionPolicy.version must be a string.",
    ],
    [
      "version blank (domain)",
      { decisionPolicy: { ...policy, version: " " } },
      "merchants[0].decisionPolicy.version is invalid (",
    ],
    [
      "threshold out of range (domain)",
      { decisionPolicy: { ...policy, threshold: 2 } },
      "merchants[0].decisionPolicy.threshold is invalid (",
    ],
    [
      "priority incomplete (domain)",
      { decisionPolicy: { ...policy, priority: ["fit"] } },
      "merchants[0].decisionPolicy.priority is invalid (",
    ],
    [
      "highIntent, moved to the commercial policy",
      { decisionPolicy: { ...policy, highIntent: "from-checkout" } },
      "merchants[0].decisionPolicy.highIntent moved to commercialPolicy.",
    ],
    [
      "interventionsPerSession, moved to the commercial policy",
      { decisionPolicy: { ...policy, interventionsPerSession: 1 } },
      "merchants[0].decisionPolicy.interventionsPerSession moved to commercialPolicy.",
    ],
    [
      "abandonment, moved to the commercial policy",
      { decisionPolicy: { ...policy, abandonment: "nothing" } },
      "merchants[0].decisionPolicy.abandonment moved to commercialPolicy.",
    ],
    [
      "evidence with a stranger (domain)",
      { decisionPolicy: { ...policy, evidence: { freshStockAndPrice: ["size"], availableVariant: [] } } },
      "merchants[0].decisionPolicy.evidence.freshStockAndPrice is invalid (",
    ],
    [
      "rules not an array",
      { decisionPolicy: { ...policy, rules: {} } },
      "merchants[0].decisionPolicy.rules must be an array of rules.",
    ],
    [
      "rule without strength",
      { decisionPolicy: { ...policy, rules: [{ ...policy.rules[0], strength: "weak" }] } },
      "merchants[0].decisionPolicy.rules[0].strength must be one of strong, supporting.",
    ],
    [
      "unknown fact",
      { decisionPolicy: { ...policy, rules: [{ ...policy.rules[0], when: { fact: "mood" } }] } },
      "merchants[0].decisionPolicy.rules[0].when.fact must be one of eventCount, dwellSeconds, sequence, productAttribute, returnedToProduct, variantAvailable, sessionAddedToCart, sessionEnteredCheckout.",
    ],
    [
      "unknown block inside a nested condition (domain)",
      {
        decisionPolicy: {
          ...policy,
          rules: [
            policy.rules[0],
            {
              id: "r",
              barrier: "returns",
              strength: "strong",
              when: { all: [{ fact: "returnedToProduct" }, { fact: "dwellSeconds", block: "footer" }] },
            },
            policy.rules[1],
          ],
        },
      },
      "merchants[0].decisionPolicy.rules[1].when.all[1].block is invalid (",
    ],
    [
      "a barrier without rules (domain)",
      { decisionPolicy: { ...policy, rules: [policy.rules[0], policy.rules[1]] } },
      "merchants[0].decisionPolicy.rules is invalid (",
    ],
    [
      "duplicate id (domain)",
      { decisionPolicy: { ...policy, rules: [...policy.rules, policy.rules[0]] } },
      "merchants[0].decisionPolicy.rules[3].id is invalid (",
    ],
    [
      "weight above 1 (domain)",
      {
        decisionPolicy: {
          ...policy,
          rules: [{ ...policy.rules[0], weight: 3 }, policy.rules[1], policy.rules[2]],
        },
      },
      "merchants[0].decisionPolicy.rules[0].weight is invalid (",
    ],
    [
      "min not a number",
      {
        decisionPolicy: {
          ...policy,
          rules: [{ ...policy.rules[0], when: { fact: "eventCount", type: "cta_approached", min: "2" } }],
        },
      },
      "merchants[0].decisionPolicy.rules[0].when.min must be a number.",
    ],
    [
      "sequence without then",
      {
        decisionPolicy: {
          ...policy,
          rules: [{ ...policy.rules[0], when: { fact: "sequence", first: { type: "added_to_cart" } } }],
        },
      },
      "merchants[0].decisionPolicy.rules[0].when.then is not an object.",
    ],
  ])("decisionPolicy %s is refused naming the field", (_name, over, message) => {
    const raw = JSON.stringify([{ ...merchant, ...over }]);
    expect(() => readConfig({ OPE_MERCHANTS: raw }, noFile)).toThrow(ConfigError);
    expect(() => readConfig({ OPE_MERCHANTS: raw }, noFile)).toThrow(message);
  });

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

  it("commercialPolicy is optional; a valid one is built, and one with only a version takes the defaults", () => {
    const merchants = readConfig({ OPE_MERCHANTS: JSON.stringify([merchant]) }, noFile).merchants;
    expect(merchants[0]?.commercialPolicy).toBeUndefined();
    expect(merchants[0]?.evidenceProfile).toBeUndefined();
    const full = readConfig(
      { OPE_MERCHANTS: JSON.stringify([{ ...merchant, commercialPolicy: commercial }]) },
      noFile,
    ).merchants[0]?.commercialPolicy;
    expect(full).toMatchObject({
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
    });
    const minimal = readConfig(
      { OPE_MERCHANTS: JSON.stringify([{ ...merchant, commercialPolicy: { version: "c-1" } }]) },
      noFile,
    ).merchants[0]?.commercialPolicy;
    expect(minimal).toMatchObject({
      version: "c-1",
      maxIncentivePercent: 10,
      incentiveLadderPercent: [5, 10],
      directIncentiveOnPrice: true,
      highIntent: "from-checkout",
      abandonment: "reassure-returns",
      interventionsPerSession: 1,
      cooldownSeconds: 0,
      interventionsPerVisitorPerDay: 3,
    });
    expect(minimal?.marginPercent).toBeUndefined();
  });

  it("evidenceProfile: anything absent is false or empty", () => {
    const read = (evidenceProfile: unknown) =>
      readConfig({ OPE_MERCHANTS: JSON.stringify([{ ...merchant, evidenceProfile }]) }, noFile).merchants[0]
        ?.evidenceProfile;
    expect(read({})).toEqual({ returnsPolicy: false, fitData: false, authorizedAttributes: [] });
    expect(read({ returnsPolicy: true, authorizedAttributes: ["material"] })).toEqual({
      returnsPolicy: true,
      fitData: false,
      authorizedAttributes: ["material"],
    });
  });

  it.each<[string, Record<string, unknown>, string]>([
    ["commercial not an object", { commercialPolicy: 3 }, "merchants[0].commercialPolicy is not an object."],
    [
      "commercial without version",
      { commercialPolicy: {} },
      "merchants[0].commercialPolicy.version must be a string.",
    ],
    [
      "ladder not numbers",
      { commercialPolicy: { ...commercial, incentiveLadderPercent: ["5"] } },
      "merchants[0].commercialPolicy.incentiveLadderPercent must be an array of numbers.",
    ],
    [
      "a step above the ceiling (domain)",
      { commercialPolicy: { ...commercial, incentiveLadderPercent: [5, 20] } },
      "merchants[0].commercialPolicy.incentiveLadderPercent[1] is invalid (",
    ],
    [
      "margin out of range (domain)",
      { commercialPolicy: { ...commercial, marginPercent: 150 } },
      "merchants[0].commercialPolicy.marginPercent is invalid (",
    ],
    [
      "return risk with an unknown block (domain)",
      {
        commercialPolicy: { ...commercial, returnRisk: { all: [{ fact: "dwellSeconds", block: "footer" }] } },
      },
      "merchants[0].commercialPolicy.returnRisk.all[0].block is invalid (",
    ],
    [
      "highIntent unknown",
      { commercialPolicy: { ...commercial, highIntent: "sometimes" } },
      "merchants[0].commercialPolicy.highIntent must be one of from-cart, from-checkout, never.",
    ],
    [
      "cooldown negative (domain)",
      { commercialPolicy: { ...commercial, cooldownSeconds: -5 } },
      "merchants[0].commercialPolicy.cooldownSeconds is invalid (",
    ],
    [
      "visitor budget zero (domain)",
      { commercialPolicy: { ...commercial, interventionsPerVisitorPerDay: 0 } },
      "merchants[0].commercialPolicy.interventionsPerVisitorPerDay is invalid (",
    ],
    [
      "profile with a non-boolean",
      { evidenceProfile: { returnsPolicy: "yes" } },
      "merchants[0].evidenceProfile.returnsPolicy must be a boolean.",
    ],
    [
      "profile attributes not strings",
      { evidenceProfile: { authorizedAttributes: [1] } },
      "merchants[0].evidenceProfile.authorizedAttributes must be an array of strings.",
    ],
  ])("commercialPolicy / evidenceProfile %s is refused naming the field", (_name, over, message) => {
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
      '[{"merchantId":"m","ingestKeys":[],"origins":["o"]}]',
      "merchants[0].ingestKeys must have one or two keys.",
    ],
    [
      '[{"merchantId":"m","ingestKeys":["a","b","c"],"origins":["o"]}]',
      "merchants[0].ingestKeys must have one or two keys.",
    ],
    [
      '[{"merchantId":"m","ingestKeys":["k"],"origins":[]}]',
      "merchants[0].origins must have at least one origin.",
    ],
  ])("OPE_MERCHANTS=%s is refused: %s", (raw, message) => {
    expect(() => readConfig({ OPE_MERCHANTS: raw }, noFile)).toThrow(ConfigError);
    expect(() => readConfig({ OPE_MERCHANTS: raw }, noFile)).toThrow(message);
  });
});
