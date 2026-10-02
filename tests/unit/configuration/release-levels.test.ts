// Feature 017 — US2 (FR-011, SC-005; constitution XI): the two levels of the release are read
// from the real files and judged against the vocabulary of the code: a default the code does
// not know fails the build, not the start. What the default policies encode (the values proposed
// to the stakeholder in features 011 and 012) keeps its checks here.
//
// **What the files hold is the seed and not a version** (feature 036): the name of a level is minted by the
// store from its number, so these files declare values only, and the name the boot puts on what it reads is
// `<level>-seed` — which no publication can mint. The fingerprint of the two default policies changed job
// with it: it used to be paired with the version the file declared, and now it pins the **content of the
// seed** on its own.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  readPlatformConfiguration,
  readTreatmentDefaults,
} from "../../../src/application/configuration/index.js";
import { withoutSchemaReference } from "../../../src/composition/env.js";
import { FactContext, Signals } from "../../../src/domain/barrier/index.js";
import { SURFACES, SYNC_MODES } from "../../../src/domain/configuration/index.js";
import { CANDIDATES } from "../../../src/domain/selection/index.js";
import { BARRIERS, hours, minutes } from "../../../src/domain/shared-kernel/index.js";
import { addedToCart, dwell, removedFromCart, variantSelector } from "../../helpers/events.js";
import { testLevels } from "../../helpers/test-app.js";

const PLATFORM = "config/platform.json";
const DEFAULTS = "config/treatment-defaults.json";
/**
 * A release file as the boot reads it: its values, with the name of the seed on them.
 *
 * The name is added here because the file does not carry one and the reader requires it — the same thing
 * `levels-config.ts` does, and the reason the two levels validate against their `Content` schema.
 */
const read = (file: string, level: "platform" | "defaults"): Record<string, unknown> => ({
  ...(withoutSchemaReference(JSON.parse(readFileSync(file, "utf8"))) as Record<string, unknown>),
  version: `${level}-seed`,
});
const platform = () => testLevels().platform;
const defaults = () => testLevels().defaults;

describe("config/platform.json (level 1)", () => {
  it("resolves with the values the platform published so far: a day of dedup, five minutes of skew, a week of grace", () => {
    const loaded = readPlatformConfiguration(read(PLATFORM, "platform"));
    expect(loaded.ok, loaded.ok ? "" : loaded.error.message).toBe(true);
    expect(platform().version).toBe("platform-seed");
    expect(platform().dedupWindow).toEqual({ ttlMs: hours(24), maxIds: 100_000 });
    expect(platform().clockSkewToleranceMs).toBe(minutes(5));
    expect(platform().eventPastToleranceMs).toBe(hours(24));
    // Thirty minutes, and it is the one value of this file that is not a day: the duration of a
    // session is a rule the SDK obeys (FR-001, feature 032), not a retention like the rest.
    expect(platform().sessionDurationMs).toBe(minutes(30));
    expect(platform().visitorWindowMs).toBe(hours(24));
    expect(platform().signatureWindowMs).toBe(minutes(5));
    expect(platform().rotationGraceMaxMs).toBe(hours(168));
    expect(platform().anchorDiagnosticsKept).toBe(200);
    expect(platform().unmappedValuesKept).toBe(200);
  });

  it("a value out of its range, an unknown field or a missing one fails naming the field", () => {
    const raw = read(PLATFORM, "platform");
    const zero = readPlatformConfiguration({ ...raw, sessionDurationMs: 0 });
    expect(zero.ok ? undefined : zero.error.details).toMatchObject({ pointer: "sessionDurationMs" });
    const unknown = readPlatformConfiguration({ ...raw, retries: 3 });
    expect(unknown.ok ? undefined : unknown.error.details).toMatchObject({ pointer: "retries" });
    const { version, ...noVersion } = raw;
    expect(version).toBe("platform-seed");
    const missing = readPlatformConfiguration(noVersion);
    expect(missing.ok ? undefined : missing.error.details).toMatchObject({ pointer: "version" });
  });
});

describe("config/treatment-defaults.json (level 2)", () => {
  it("resolves, and every value of the closed vocabularies is one the code knows", () => {
    const loaded = readTreatmentDefaults(read(DEFAULTS, "defaults"));
    expect(loaded.ok, loaded.ok ? "" : loaded.error.message).toBe(true);
    const { values } = defaults();
    expect(defaults().version).toBe("defaults-seed");
    expect(values.barriers.every((b) => BARRIERS.includes(b))).toBe(true);
    expect(values.surfaces.every((s) => SURFACES.includes(s))).toBe(true);
    expect(Object.values(values.syncStrategy).every((m) => SYNC_MODES.includes(m))).toBe(true);
    expect(values.decisionPolicy.priority).toEqual(["returns", "fit", "price"]);
    for (const barrier of BARRIERS) expect(CANDIDATES[barrier].length).toBeGreaterThan(0);
  });

  it("carries the freshness and the level thresholds published so far: 36 h / 15 min; 8 receipts, 36 h, 1 h, 15 min, 3", () => {
    const { values } = defaults();
    expect(values.freshness.record()).toEqual({ catalogMs: hours(36), stockAndPriceMs: minutes(15) });
    expect(values.syncLevel.record()).toEqual({
      receiptsKept: 8,
      noDataAfterMs: hours(36),
      minutesLevelMaxAgeMs: hours(1),
      minutesLevelMedianIntervalMs: minutes(15),
      minutesLevelMinReceipts: 3,
    });
    expect(values.holdoutShare).toBe(0.05);
    // The release ships a language since feature 027: with none, no family has a text and OPE is
    // mute — which is fail-closed but useless. The merchant overrides it; it is never a constant.
    expect(values.locales).toEqual({ supported: ["es"], fallback: "es" });
    expect(values.evidenceProfile).toEqual({
      returnsPolicy: false,
      fitData: false,
      authorizedAttributes: [],
    });
  });

  it("the default decision policy encodes the inference values proposed to the stakeholder (feature 011)", () => {
    const policy = defaults().values.decisionPolicy;
    expect(policy.version).toBe("default-1");
    expect(policy.threshold).toBe(0.6);
    expect(policy.rules.weights).toEqual({ strong: 0.4, supporting: 0.2 });
    expect(policy.rules.readingSeconds).toBe(5);
    expect(policy.evidence).toEqual({ freshStockAndPrice: ["price"], availableVariant: ["fit"] });
    expect(policy.rules.rules.map((r) => [r.id, r.barrier, r.strength])).toEqual([
      ["fit.variant-selector-twice", "fit", "strong"],
      ["fit.specifications-read", "fit", "strong"],
      ["fit.variants-compared", "fit", "strong"],
      ["fit.photo-zoomed", "fit", "supporting"],
      ["fit.returned-to-product", "fit", "supporting"],
      ["price.cart-removed-without-reading", "price", "strong"],
      ["price.price-read", "price", "strong"],
      ["price.returned-and-price-read", "price", "strong"],
      ["price.cta-approached", "price", "supporting"],
      ["price.checkout-then-exit", "price", "supporting"],
      ["returns.policies-read", "returns", "strong"],
      ["returns.cart-then-policies", "returns", "strong"],
      ["returns.variant-doubt-and-policies", "returns", "strong"],
      ["returns.photos-and-description", "returns", "supporting"],
      ["returns.policies-then-cart-removed", "returns", "supporting"],
    ]);
    const product = { attributes: new Map<string, string>(), available: true };
    expect(
      policy.rules.infer(Signals.of([variantSelector(1), variantSelector(2)]), product).confidences.fit,
    ).toBe(0.4);
    expect(
      policy.rules.infer(
        Signals.of([variantSelector(1), variantSelector(2), dwell(3, "specifications", 6000)]),
        product,
      ).confidences.fit,
    ).toBe(0.8);
    expect(policy.rules.infer(Signals.of([addedToCart(1), removedFromCart(2)]), product).confidences).toEqual(
      {
        fit: 0,
        price: 0.4,
        returns: 0,
      },
    );
  });

  it("the default commercial policy encodes the values proposed to the stakeholder (feature 012): no margin, so no incentive", () => {
    const policy = defaults().values.commercialPolicy;
    expect(policy.version).toBe("commercial-default-1");
    expect(policy.maxIncentiveShare).toBe(0.1);
    expect(policy.incentiveLadderShare).toEqual([0.05, 0.1]);
    expect(policy.marginShare).toBeUndefined();
    expect(policy.directIncentiveOnPrice).toBe(true);
    expect(policy.highIntent).toBe("from-checkout");
    expect(policy.abandonment).toBe("reassure-returns");
    expect(policy.interventionsPerSession).toBe(1);
    expect(policy.cooldownSeconds).toBe(0);
    expect(policy.interventionsPerVisitorPerDay).toBe(3);
    const facts = (events: Parameters<typeof Signals.of>[0]) =>
      FactContext.of({ signals: Signals.of(events), product: { attributes: new Map() }, readingSeconds: 5 });
    expect(
      facts([variantSelector(1), variantSelector(2), dwell(3, "policies", 6000)]).holds(policy.returnRisk),
    ).toBe(true);
    expect(facts([variantSelector(1), dwell(3, "policies", 6000)]).holds(policy.returnRisk)).toBe(false);
  });

  it("the content of the default policies is bound to the version of the file: change one, change the other", () => {
    const raw = read(DEFAULTS, "defaults") as unknown as {
      decisionPolicy: unknown;
      commercialPolicy: unknown;
    };
    const fingerprint = createHash("sha256")
      .update(JSON.stringify([raw.decisionPolicy, raw.commercialPolicy]))
      .digest("hex")
      .slice(0, 16);
    // **What this pins and what it stopped pinning** (feature 036). It used to be read together with the
    // version the file declared, so that changing the treatment without bumping the name failed here; the
    // file no longer names a version —the store mints it— so what is left is the content itself. Changing
    // either policy fails this line, and whoever changes it has to say in the commit that the **seed's**
    // treatment changed, which is the half that was ever worth catching: from the second boot on, what is in
    // force is what an operator published and this file governs nothing but a first boot.
    expect(fingerprint).toBe("68a16172254e6fe2");
  });

  it("the defaults must be complete: a policy or a profile that lacks a field is refused naming it, and a spare field too", () => {
    const raw = read(DEFAULTS, "defaults") as unknown as Record<string, Record<string, unknown>>;
    const without = (part: string, field: string): Record<string, unknown> => {
      const { [field]: dropped, ...rest } = raw[part] ?? {};
      expect(dropped).toBeDefined();
      return { ...raw, [part]: rest };
    };
    for (const [part, field] of [
      ["decisionPolicy", "rules"],
      ["decisionPolicy", "weights"],
      ["commercialPolicy", "highIntent"],
      ["commercialPolicy", "cooldownSeconds"],
      ["evidenceProfile", "fitData"],
      ["freshness", "catalogMs"],
      ["syncLevel", "receiptsKept"],
      ["syncStrategy", "returns"],
    ] as const) {
      const result = readTreatmentDefaults(without(part, field));
      expect(result.ok ? undefined : result.error.details, `${part}.${field}`).toMatchObject({
        pointer: `${part}.${field}`,
      });
    }
    const spare = readTreatmentDefaults({ ...raw, evidenceProfile: { ...raw["evidenceProfile"], mood: 1 } });
    expect(spare.ok ? undefined : spare.error.details).toMatchObject({ pointer: "evidenceProfile.mood" });
    const { holdoutShare, ...noHoldout } = raw;
    expect(holdoutShare).toBe(0.05);
    const missing = readTreatmentDefaults(noHoldout);
    expect(missing.ok ? undefined : missing.error.details).toMatchObject({ pointer: "holdoutShare" });
  });

  it("a value the vocabulary does not know fails naming the field", () => {
    const raw = read(DEFAULTS, "defaults");
    const barrier = readTreatmentDefaults({ ...raw, barriers: ["fit", "shipping"] });
    expect(barrier.ok ? undefined : barrier.error.details).toMatchObject({ pointer: "barriers[1]" });
    const mode = readTreatmentDefaults({
      ...raw,
      syncStrategy: { catalog: "ftp", stockAndPrice: "push", orders: "push", returns: "push" },
    });
    expect(mode.ok ? undefined : mode.error.details).toMatchObject({ pointer: "syncStrategy.catalog" });
    const fact = readTreatmentDefaults({
      ...raw,
      commercialPolicy: { ...(raw["commercialPolicy"] as object), returnRisk: { fact: "socialProof" } },
    });
    expect(fact.ok ? undefined : fact.error.details).toMatchObject({
      pointer: "commercialPolicy.returnRisk.fact",
    });
    const ladder = readTreatmentDefaults({
      ...raw,
      commercialPolicy: { ...(raw["commercialPolicy"] as object), incentiveLadderShare: [0.1, 0.05] },
    });
    expect(ladder.ok ? undefined : ladder.error.details).toMatchObject({
      pointer: "commercialPolicy.incentiveLadderShare[1]",
    });
  });
});
