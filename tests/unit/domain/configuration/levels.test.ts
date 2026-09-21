// Feature 017 — US2 (FR-010, FR-011, FR-014; constitution XI; ADR-031): the levels of the
// configuration only exist valid — every value judged by its owner, the first offence named by
// its field — and the treatment values merge value by value over the defaults. The levels are
// read inside each test: what a file evaluates while it loads is static for the mutation gate.
import { describe, expect, it } from "vitest";
import {
  AnchorMap,
  PlatformConfiguration,
  PolicyInput,
  TreatmentDefaults,
  TreatmentValues,
  type DeclaredTreatmentValues,
  type PlatformConfigurationRecord,
  type TreatmentValuesRecord,
} from "../../../../src/domain/configuration/index.js";
import { testLevels } from "../../../helpers/test-app.js";

const platform = (): PlatformConfigurationRecord => testLevels().platform.record();
const defaults = () => testLevels().defaults.record();
const values = (): TreatmentValuesRecord => {
  const { version, ...rest } = defaults();
  expect(version).toBe("defaults-1");
  return rest;
};

const pointerOf = (result: { ok: true } | { ok: false; error: { details: Record<string, unknown> } }) =>
  result.ok ? undefined : result.error.details["pointer"];

describe("PlatformConfiguration.of", () => {
  it("accepts the release values and answers them back as its record", () => {
    const built = PlatformConfiguration.of(platform());
    expect(built.ok ? built.value.record() : undefined).toEqual(platform());
    expect(PlatformConfiguration.rehydrate(platform()).record()).toEqual(platform());
  });

  it("refuses a value out of its range naming the field", () => {
    const cases: [Partial<PlatformConfigurationRecord>, string][] = [
      [{ version: " " }, "version"],
      [{ dedupWindow: { ttlMs: 0, maxIds: 10 } }, "dedupWindow.ttlMs"],
      [{ dedupWindow: { ttlMs: 10, maxIds: 1.5 } }, "dedupWindow.maxIds"],
      [{ sessionWindowMs: 0 }, "sessionWindowMs"],
      [{ visitorWindowMs: -1 }, "visitorWindowMs"],
      [{ signatureWindowMs: 0 }, "signatureWindowMs"],
      [{ eventPastToleranceMs: 0 }, "eventPastToleranceMs"],
      [{ clockSkewToleranceMs: -1 }, "clockSkewToleranceMs"],
      [{ rotationGraceMaxMs: 0.5 }, "rotationGraceMaxMs"],
      [{ anchorDiagnosticsKept: 0 }, "anchorDiagnosticsKept"],
    ];
    for (const [over, pointer] of cases) {
      expect(pointerOf(PlatformConfiguration.of({ ...platform(), ...over })), pointer).toBe(pointer);
    }
  });

  it("the edges are inside: a skew and a grace of zero, one diagnostic, one id, one millisecond of window", () => {
    expect(
      PlatformConfiguration.of({
        ...platform(),
        clockSkewToleranceMs: 0,
        rotationGraceMaxMs: 0,
        anchorDiagnosticsKept: 1,
        dedupWindow: { ttlMs: 1, maxIds: 1 },
        sessionWindowMs: 1,
        visitorWindowMs: 1,
        signatureWindowMs: 1,
        eventPastToleranceMs: 1,
      }).ok,
    ).toBe(true);
  });
});

describe("TreatmentDefaults.of and TreatmentValues.judge", () => {
  it("accepts the release values; the record round-trips; the holdout is a rate inside", () => {
    const built = TreatmentDefaults.of(defaults());
    expect(built.ok ? built.value.record() : undefined).toEqual(defaults());
    expect(built.ok ? built.value.values.holdoutShare : undefined).toBe(0.05);
    expect(pointerOf(TreatmentDefaults.of({ ...defaults(), version: "" }))).toBe("version");
    // The edges of the holdout are inside: nobody kept out, or everybody.
    for (const holdoutPercent of [0, 100]) {
      const edge = TreatmentValues.judge({ ...values(), holdoutPercent });
      expect(edge.ok ? edge.value.holdoutShare : edge.error).toBe(holdoutPercent / 100);
    }
  });

  it("refuses a value that violates the invariants of its type naming the field", () => {
    const v = values();
    const cases: [Partial<TreatmentValuesRecord>, string][] = [
      [{ freshness: { catalogMs: 0, stockAndPriceMs: 1 } }, "freshness.catalogMs"],
      [{ freshness: { catalogMs: 10, stockAndPriceMs: 20 } }, "freshness.stockAndPriceMs"],
      [{ syncLevel: { ...v.syncLevel, noDataAfterMs: 0 } }, "syncLevel.noDataAfterMs"],
      [{ holdoutPercent: 101 }, "holdoutPercent"],
      [{ holdoutPercent: 2.5 }, "holdoutPercent"],
      [{ surfaces: [] }, "surfaces"],
      [{ surfaces: ["product", "product"] }, "surfaces"],
      [{ barriers: ["fit", "shipping" as never] }, "barriers[1]"],
      [{ syncStrategy: { ...v.syncStrategy, orders: "ftp" as never } }, "syncStrategy.orders"],
      [{ locales: { supported: ["es_AR"] } }, "locales.supported[0]"],
      [{ locales: { supported: ["es", "es"] } }, "locales.supported"],
      [{ locales: { supported: ["es"], fallback: "en" } }, "locales.fallback"],
      [{ decisionPolicy: { ...v.decisionPolicy, threshold: 2 } }, "decisionPolicy.threshold"],
      [{ decisionPolicy: { ...v.decisionPolicy, priority: ["fit"] } }, "decisionPolicy.priority"],
      [
        {
          decisionPolicy: {
            ...v.decisionPolicy,
            rules: [
              {
                id: "x",
                barrier: "fit",
                strength: "strong",
                when: { fact: "eventCount", type: "teleported" as never, min: 1 },
              },
            ],
          },
        },
        "decisionPolicy.rules[0].when.type",
      ],
      [
        { commercialPolicy: { ...v.commercialPolicy, maxIncentivePercent: 120 } },
        "commercialPolicy.maxIncentivePercent",
      ],
      [
        { commercialPolicy: { ...v.commercialPolicy, incentiveLadderPercent: [10, 5] } },
        "commercialPolicy.incentiveLadderPercent[1]",
      ],
      [
        { commercialPolicy: { ...v.commercialPolicy, incentiveLadderPercent: [2.5] } },
        "commercialPolicy.incentiveLadderPercent[0]",
      ],
      [{ commercialPolicy: { ...v.commercialPolicy, marginPercent: 101 } }, "commercialPolicy.marginPercent"],
      [
        { commercialPolicy: { ...v.commercialPolicy, marginPercent: 12.5 } },
        "commercialPolicy.marginPercent",
      ],
      [
        { commercialPolicy: { ...v.commercialPolicy, maxIncentivePercent: 12.5 } },
        "commercialPolicy.maxIncentivePercent",
      ],
      [{ commercialPolicy: { ...v.commercialPolicy, version: " " } }, "commercialPolicy.version"],
      [{ decisionPolicy: { ...v.decisionPolicy, version: "" } }, "decisionPolicy.version"],
      [
        {
          decisionPolicy: {
            ...v.decisionPolicy,
            rules: [
              { id: "x", barrier: "fit", strength: "strong", weight: 2, when: { fact: "returnedToProduct" } },
            ],
          },
        },
        "decisionPolicy.rules[0].weight",
      ],
      [
        { commercialPolicy: { ...v.commercialPolicy, cooldownSeconds: -1 } },
        "commercialPolicy.cooldownSeconds",
      ],
    ];
    for (const [over, pointer] of cases) {
      expect(pointerOf(TreatmentValues.judge({ ...v, ...over })), pointer).toBe(pointer);
    }
  });

  it("the resolution: what is declared wins value by value, the rest keeps the default; a declared policy names its version and keeps the undeclared fields", () => {
    const v = values();
    const declared: DeclaredTreatmentValues = {
      freshness: { stockAndPriceMs: 600_000 },
      holdoutPercent: 0,
      commercialPolicy: { version: "sport-1", marginPercent: 40 },
      decisionPolicy: { version: "d-2", threshold: 0.7 },
      locales: { supported: ["es-AR"] },
      syncStrategy: { catalog: "pull" },
    };
    const resolved = TreatmentValues.resolve(v, declared);
    if (!resolved.ok) throw new Error(resolved.error.message);
    const record = resolved.value.record();
    expect(record.freshness).toEqual({ catalogMs: v.freshness.catalogMs, stockAndPriceMs: 600_000 });
    expect(record.holdoutPercent).toBe(0);
    expect(resolved.value.holdoutShare).toBe(0);
    expect(record.commercialPolicy).toEqual({ ...v.commercialPolicy, version: "sport-1", marginPercent: 40 });
    expect(resolved.value.commercialPolicy.marginShare).toBe(0.4);
    expect(resolved.value.decisionPolicy.version).toBe("d-2");
    expect(resolved.value.decisionPolicy.threshold).toBe(0.7);
    expect(resolved.value.decisionPolicy.rules.rules).toHaveLength(v.decisionPolicy.rules.length);
    expect(record.locales).toEqual({ supported: ["es-AR"] });
    const withFallback = TreatmentValues.resolve(v, {
      locales: { supported: ["es-AR", "en"], fallback: "en" },
    });
    expect(withFallback.ok ? withFallback.value.record().locales : undefined).toEqual({
      supported: ["es-AR", "en"],
      fallback: "en",
    });
    expect(withFallback.ok ? withFallback.value.locales.fallback : undefined).toBe("en");
    expect(record.syncStrategy).toEqual({ ...v.syncStrategy, catalog: "pull" });
    expect(record.surfaces).toEqual(v.surfaces);
    expect(TreatmentValues.merged(v, {})).toEqual(v);
  });

  it("an undefined declared field declares nothing; a declared value the merge makes invalid is refused at its field", () => {
    const partial = { a: undefined, b: 3 } as unknown as Partial<{ a: number; b: number }>;
    expect(PolicyInput.merge({ a: 1, b: 2 }, partial)).toEqual({ a: 1, b: 3 });
    expect(
      pointerOf(
        TreatmentValues.resolve(values(), {
          commercialPolicy: { version: "c", incentiveLadderPercent: [20] },
        }),
      ),
    ).toBe("commercialPolicy.incentiveLadderPercent[0]");
  });
});

describe("AnchorMap", () => {
  it("accepts anchors of the vocabulary with non-blank selectors and answers them by anchor", () => {
    const built = AnchorMap.of({
      price: { selectors: [".price", "#price"] },
      cta: { selectors: ["button.buy"] },
    });
    if (!built.ok) throw new Error(built.error.message);
    expect(built.value.selectorsOf("price")).toEqual([".price", "#price"]);
    expect(built.value.selectorsOf("policies")).toBeUndefined();
    expect(AnchorMap.rehydrate(built.value.record()).record()).toEqual({
      price: { selectors: [".price", "#price"] },
      cta: { selectors: ["button.buy"] },
    });
  });

  it("refuses an unknown anchor, an empty list and a blank selector naming the field", () => {
    expect(pointerOf(AnchorMap.of({ hero: { selectors: [".x"] } } as never))).toBe("anchors.hero");
    expect(pointerOf(AnchorMap.of({ price: { selectors: [] } }))).toBe("anchors.price.selectors");
    expect(pointerOf(AnchorMap.of({ price: { selectors: [".x", " "] } }))).toBe("anchors.price.selectors[1]");
    expect(pointerOf(AnchorMap.of({ price: { selectors: ["", ".x"] } }))).toBe("anchors.price.selectors[0]");
  });
});
