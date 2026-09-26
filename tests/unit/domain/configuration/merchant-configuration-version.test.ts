// Feature 017 — US2 (FR-012, FR-015; 01 §14.2; ADR-031): a merchant version is numbered by the
// store and immutable; its own rules (a corrective one needs a reason, the anchor map is judged)
// and the resolution over the levels stamp the three versions every decision carries.
import { describe, expect, it } from "vitest";
import {
  ConfigurationReasonRequired,
  EffectiveConfiguration,
  InvalidConfigurationValue,
  MerchantConfigurationVersion,
  type ConfigurationDraft,
} from "../../../../src/domain/configuration/index.js";
import { asOperatorId } from "../../../../src/domain/operator/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";
import { testLevels } from "../../../helpers/test-app.js";

const NOW = new Date("2026-09-20T12:00:00.000Z");
const draft = (over: Partial<ConfigurationDraft> = {}): ConfigurationDraft => ({
  merchantId: asMerchantId("m_a"),
  declared: { freshness: { stockAndPriceMs: 600_000 }, locales: { supported: ["es-AR"] } },
  corrective: false,
  publishedAt: NOW,
  operatorId: asOperatorId("ops-1"),
  ...over,
});

describe("MerchantConfigurationVersion.draft", () => {
  it("[invariant:configuration-reason-required] a corrective version without a reason, or with a blank one, is refused", () => {
    expect(MerchantConfigurationVersion.draft(draft({ corrective: true })).ok).toBe(false);
    const blank = MerchantConfigurationVersion.draft(draft({ corrective: true, reason: "  " }));
    expect(blank.ok ? undefined : blank.error).toBeInstanceOf(ConfigurationReasonRequired);
    expect(MerchantConfigurationVersion.draft(draft({ corrective: true, reason: "anchor fix" })).ok).toBe(
      true,
    );
    expect(MerchantConfigurationVersion.draft(draft()).ok).toBe(true);
  });

  it("[invariant:invalid-configuration-value] the anchor map of the draft is judged here: it has no default to resolve against", () => {
    const bad = MerchantConfigurationVersion.draft(
      draft({ declared: { anchors: { price: { selectors: [] } } } }),
    );
    expect(bad.ok ? undefined : bad.error).toBeInstanceOf(InvalidConfigurationValue);
    expect(bad.ok ? undefined : bad.error.details).toEqual({
      pointer: "anchors.price.selectors",
      problem: "must not be empty",
    });
  });
});

describe("MerchantConfigurationVersion", () => {
  const first = MerchantConfigurationVersion.numbered(draft(), 1);

  it("is the draft with its number; the record round-trips through rehydrate; the reason only when present", () => {
    expect(first.version).toBe(1);
    expect(first.record()).not.toHaveProperty("reason");
    const back = MerchantConfigurationVersion.rehydrate(first.record());
    expect(back.record()).toEqual(first.record());
    const corrective = MerchantConfigurationVersion.numbered(draft({ corrective: true, reason: "fix" }), 2);
    expect(corrective.record()).toMatchObject({ version: 2, corrective: true, reason: "fix" });
  });

  it("sameContentAs: the same declared values in any key order repeat it; a different value, flag or reason does not", () => {
    expect(first.sameContentAs(draft())).toBe(true);
    expect(
      first.sameContentAs(
        draft({ declared: { locales: { supported: ["es-AR"] }, freshness: { stockAndPriceMs: 600_000 } } }),
      ),
    ).toBe(true);
    const undefinedField = {
      ...draft().declared,
      holdoutShare: undefined,
    } as unknown as ConfigurationDraft["declared"];
    expect(first.sameContentAs(draft({ declared: undefinedField }))).toBe(true);
    expect(first.sameContentAs(draft({ declared: { freshness: { stockAndPriceMs: 500_000 } } }))).toBe(false);
    expect(first.sameContentAs(draft({ corrective: true }))).toBe(false);
    expect(first.sameContentAs(draft({ reason: "x" }))).toBe(false);
  });

  it("anchorMap: the map of the version when it declared one", () => {
    expect(first.anchorMap()).toBeUndefined();
    const mapped = MerchantConfigurationVersion.numbered(
      draft({ declared: { anchors: { cta: { selectors: ["a"] } } } }),
      1,
    );
    expect(mapped.anchorMap()?.selectorsOf("cta")).toEqual(["a"]);
  });
});

describe("EffectiveConfiguration.resolve", () => {
  const platform = () => testLevels().platform;
  const defaults = () => testLevels().defaults;

  it("without a merchant version: the defaults as they are, the platform, and two versions", () => {
    const resolved = EffectiveConfiguration.resolve(platform(), defaults());
    if (!resolved.ok) throw new Error(resolved.error.message);
    expect(resolved.value.versions).toEqual({ platform: "platform-1", defaults: "defaults-1" });
    expect(resolved.value.values).toBe(defaults().values);
    expect(resolved.value.anchors).toBeUndefined();
    expect(resolved.value.platform).toBe(platform());
  });

  it("with a version: what it declared over the defaults, its anchors, and the three versions; a draft stamps no merchant version", () => {
    const version = MerchantConfigurationVersion.numbered(
      draft({ declared: { holdoutShare: 0, anchors: { price: { selectors: [".p"] } } } }),
      3,
    );
    const resolved = EffectiveConfiguration.resolve(platform(), defaults(), version);
    if (!resolved.ok) throw new Error(resolved.error.message);
    expect(resolved.value.versions).toEqual({ platform: "platform-1", defaults: "defaults-1", merchant: 3 });
    expect(resolved.value.values.holdoutShare).toBe(0);
    expect(resolved.value.anchors?.selectorsOf("price")).toEqual([".p"]);
    const judged = EffectiveConfiguration.resolve(platform(), defaults(), draft());
    expect(judged.ok ? judged.value.versions : undefined).toEqual({
      platform: "platform-1",
      defaults: "defaults-1",
    });
  });

  it("declaring one evidence requirement keeps the default of the other (feature 029)", () => {
    // `evidence` is the only declared field that is an object of its own, so the shallow merge that
    // serves every other field would let a merchant that declares one key lose the default of the
    // other **without saying so** — the worst kind of configuration bug, because nothing complains.
    const before = defaults().values.decisionPolicy.evidence;
    expect(before.availableVariant.length).toBeGreaterThan(0);
    const version = MerchantConfigurationVersion.numbered(
      draft({
        declared: { decisionPolicy: { version: "d-2", evidence: { freshStockAndPrice: ["price"] } } },
      }),
      4,
    );
    const resolved = EffectiveConfiguration.resolve(platform(), defaults(), version);
    if (!resolved.ok) throw new Error(resolved.error.message);
    const evidence = resolved.value.values.decisionPolicy.evidence;
    expect(evidence.freshStockAndPrice).toEqual(["price"]);
    expect(evidence.availableVariant).toEqual(before.availableVariant);
  });

  it("a declared value the resolution refuses names its field", () => {
    const bad = EffectiveConfiguration.resolve(platform(), defaults(), draft({ declared: { barriers: [] } }));
    expect(bad.ok ? undefined : bad.error.details["pointer"]).toBe("barriers");
  });
});
