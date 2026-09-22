// Feature 017 — US2 (FR-011, FR-014; constitution XI): the shape readers refuse what they do not
// admit — an undeclared field in any record, a missing field where the level must be complete —
// naming the field; and read what is optional without inventing it. One case per record the
// readers close, so removing any `closed`/`required` is caught.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  readDeclaredConfiguration,
  readPlatformConfiguration,
  readTreatmentDefaults,
} from "../../../../src/application/configuration/index.js";
import { withoutSchemaReference } from "../../../../src/composition/env.js";

// The files name their schema (`$schema`, D-04 of feature 019); the readers never see the key.
const read = (file: string): Record<string, unknown> =>
  withoutSchemaReference(JSON.parse(readFileSync(file, "utf8"))) as Record<string, unknown>;
const platform = () => read("config/platform.json");
const defaults = () => read("config/treatment-defaults.json");

const pointerOf = (result: { ok: true } | { ok: false; error: { details: Record<string, unknown> } }) =>
  result.ok ? undefined : result.error.details["pointer"];
const problemOf = (result: { ok: true } | { ok: false; error: { details: Record<string, unknown> } }) =>
  result.ok ? undefined : result.error.details["problem"];

/** The record with one more key, deep: `set(o, ["a", "b"], v)`. */
function withKey(record: Record<string, unknown>, path: string[], value: unknown): Record<string, unknown> {
  const [head, ...rest] = path;
  if (head === undefined) return record;
  const inner = record[head];
  return {
    ...record,
    [head]:
      rest.length === 0
        ? value
        : withKey(
            typeof inner === "object" && inner !== null ? (inner as Record<string, unknown>) : {},
            rest,
            value,
          ),
  };
}

function without(record: Record<string, unknown>, path: string[]): Record<string, unknown> {
  const [head, ...rest] = path;
  if (head === undefined) return record;
  if (rest.length === 0) return Object.fromEntries(Object.entries(record).filter(([k]) => k !== head));
  return { ...record, [head]: without(record[head] as Record<string, unknown>, rest) };
}

const NOT_A_FIELD = "is not a field of this object";
const REQUIRED = "is required";

describe("readDeclaredConfiguration", () => {
  it("refuses an undeclared field in every record it reads, naming it", () => {
    const decision = defaults()["decisionPolicy"] as Record<string, unknown>;
    const rules = decision["rules"] as Record<string, unknown>[];
    const rule = rules[0] ?? {};
    const cases: [Record<string, unknown>, string][] = [
      [{ extra: 1 }, "extra"],
      [{ freshness: { catalogMs: 1, extra: 1 } }, "freshness.extra"],
      [{ syncLevel: { receiptsKept: 1, extra: 1 } }, "syncLevel.extra"],
      [{ locales: { supported: ["es"], extra: 1 } }, "locales.extra"],
      [{ syncStrategy: { catalog: "push", extra: 1 } }, "syncStrategy.extra"],
      [{ evidenceProfile: { returnsPolicy: true, extra: 1 } }, "evidenceProfile.extra"],
      [{ commercialPolicy: { version: "c", extra: 1 } }, "commercialPolicy.extra"],
      [
        { commercialPolicy: { version: "c", returnRisk: { fact: "sessionAddedToCart", extra: 1 } } },
        "commercialPolicy.returnRisk.extra",
      ],
      [{ decisionPolicy: { version: "d", extra: 1 } }, "decisionPolicy.extra"],
      [
        { decisionPolicy: { version: "d", weights: { strong: 0.4, extra: 1 } } },
        "decisionPolicy.weights.extra",
      ],
      [
        { decisionPolicy: { version: "d", evidence: { freshStockAndPrice: [], extra: 1 } } },
        "decisionPolicy.evidence.extra",
      ],
      [{ decisionPolicy: { version: "d", rules: [{ ...rule, extra: 1 }] } }, "decisionPolicy.rules[0].extra"],
      [
        {
          decisionPolicy: {
            version: "d",
            rules: [{ ...rule, when: { fact: "eventCount", type: "product_viewed", extra: 1 } }],
          },
        },
        "decisionPolicy.rules[0].when.extra",
      ],
      [
        {
          decisionPolicy: {
            version: "d",
            rules: [
              {
                ...rule,
                when: {
                  fact: "sequence",
                  first: { type: "product_viewed", extra: 1 },
                  then: { type: "added_to_cart" },
                },
              },
            ],
          },
        },
        "decisionPolicy.rules[0].when.first.extra",
      ],
      [{ anchors: { price: { selectors: [".p"], extra: 1 } } }, "anchors.price.extra"],
    ];
    for (const [declared, pointer] of cases) {
      const result = readDeclaredConfiguration(declared);
      expect(pointerOf(result), pointer).toBe(pointer);
      expect(problemOf(result), pointer).toBe(NOT_A_FIELD);
    }
  });

  it("reads what is optional only when it is there: languages without a fallback, a policy without weights", () => {
    const languages = readDeclaredConfiguration({ locales: { supported: ["es-AR"] } });
    expect(languages.ok ? languages.value.locales : languages.error).toEqual({ supported: ["es-AR"] });
    const withFallback = readDeclaredConfiguration({ locales: { supported: ["es-AR"], fallback: "es-AR" } });
    expect(withFallback.ok ? withFallback.value.locales : withFallback.error).toEqual({
      supported: ["es-AR"],
      fallback: "es-AR",
    });
    const strategy = readDeclaredConfiguration({ syncStrategy: { catalog: "pull" } });
    expect(strategy.ok ? strategy.value.syncStrategy : strategy.error).toEqual({ catalog: "pull" });
    const policy = readDeclaredConfiguration({ decisionPolicy: { version: "d", threshold: 0.5 } });
    expect(policy.ok ? policy.value.decisionPolicy : policy.error).toEqual({ version: "d", threshold: 0.5 });
    const commercial = readDeclaredConfiguration({ commercialPolicy: { version: "c" } });
    expect(commercial.ok ? commercial.value.commercialPolicy : commercial.error).toEqual({ version: "c" });
    expect(pointerOf(readDeclaredConfiguration({ commercialPolicy: { marginPercent: 10 } }))).toBe(
      "commercialPolicy.version",
    );
  });
});

describe("readTreatmentDefaults", () => {
  it("accepts the release file and refuses an undeclared field at the root or inside a value", () => {
    expect(readTreatmentDefaults(defaults()).ok).toBe(true);
    expect(pointerOf(readTreatmentDefaults({ ...defaults(), extra: 1 }))).toBe("extra");
    expect(pointerOf(readTreatmentDefaults(withKey(defaults(), ["freshness", "extra"], 1)))).toBe(
      "freshness.extra",
    );
  });

  it("demands every value, complete: a missing key of any part names it", () => {
    const cases: [string[], string][] = [
      [["holdoutPercent"], "holdoutPercent"],
      [["freshness", "stockAndPriceMs"], "freshness.stockAndPriceMs"],
      [["syncLevel", "receiptsKept"], "syncLevel.receiptsKept"],
      [["syncStrategy", "orders"], "syncStrategy.orders"],
      [["decisionPolicy", "priority"], "decisionPolicy.priority"],
      [["commercialPolicy", "cooldownSeconds"], "commercialPolicy.cooldownSeconds"],
      [["evidenceProfile", "fitData"], "evidenceProfile.fitData"],
    ];
    for (const [path, pointer] of cases) {
      const result = readTreatmentDefaults(without(defaults(), path));
      expect(pointerOf(result), pointer).toBe(pointer);
      expect(problemOf(result), pointer).toBe(REQUIRED);
    }
  });
});

describe("readPlatformConfiguration", () => {
  it("accepts the release file; refuses an undeclared or a missing field at the root and inside the dedup window", () => {
    expect(readPlatformConfiguration(platform()).ok).toBe(true);
    const cases: [Record<string, unknown>, string, string][] = [
      [{ ...platform(), extra: 1 }, "extra", NOT_A_FIELD],
      [withKey(platform(), ["dedupWindow", "extra"], 1), "dedupWindow.extra", NOT_A_FIELD],
      [without(platform(), ["sessionWindowMs"]), "sessionWindowMs", REQUIRED],
      [without(platform(), ["retryAfterSeconds"]), "retryAfterSeconds", REQUIRED],
      [without(platform(), ["dedupWindow", "maxIds"]), "dedupWindow.maxIds", REQUIRED],
    ];
    for (const [value, pointer, problem] of cases) {
      const result = readPlatformConfiguration(value);
      expect(pointerOf(result), pointer).toBe(pointer);
      expect(problemOf(result), pointer).toBe(problem);
    }
  });
});
