// Feature 027 — US1 (constitution X): what a merchant is served of the texts. The voice is the
// default one while there is one, and the fallback language travels **only when the merchant
// declared it** — a merchant with none and a page with no language has nothing to say, which is the
// difference between an absent field and an invented one.
import { describe, expect, it } from "vitest";
import {
  EffectiveConfiguration,
  MerchantConfigurationVersion,
  type ConfigurationDraft,
  type Locales,
} from "../../../../src/domain/configuration/index.js";
import { asOperatorId } from "../../../../src/domain/operator/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";
import { messageSettingsOf } from "../../../../src/interface-adapters/configuration/index.js";
import { testLevels } from "../../../helpers/test-app.js";
import type { ConfigurationService } from "../../../../src/application/configuration/index.js";

const A = asMerchantId("m_a");
const NOW = new Date("2026-09-25T12:00:00.000Z");

/** The effective configuration of a merchant that declared these languages, and nothing else. */
function effectiveOf(locales: Locales): EffectiveConfiguration {
  const draft: ConfigurationDraft = {
    merchantId: A,
    declared: { locales, attributeLabels: [{ label: "Denim 12oz", value: "denim" }] },
    corrective: false,
    publishedAt: NOW,
    operatorId: asOperatorId("ops-1"),
  };
  const levels = testLevels();
  const resolved = EffectiveConfiguration.resolve(
    levels.platform,
    levels.defaults,
    MerchantConfigurationVersion.numbered(draft, 1),
  );
  if (!resolved.ok) throw new Error(resolved.error.message);
  return resolved.value;
}

/** The configuration as this gateway uses it: one read, and every other method is not its business. */
const serving = (effective: EffectiveConfiguration): ConfigurationService => ({
  effectiveFor: () => Promise.resolve(effective),
  judge: () => Promise.reject(new Error("the directory does not judge")),
  apply: () => Promise.reject(new Error("the directory does not apply")),
  platform: () => Promise.reject(new Error("the directory does not read the platform")),
  defaults: () => Promise.reject(new Error("the directory does not read the defaults")),
});

describe("messageSettingsOf", () => {
  it("carries the declared fallback language, the default voice and the correspondence", async () => {
    const settings = await messageSettingsOf(
      serving(effectiveOf({ supported: ["es-AR", "en"], fallback: "es-AR" })),
    ).settingsFor(A);
    expect(settings.fallback).toBe("es-AR");
    expect(settings.voice).toBe("neutral");
    expect(settings.labels.valueOf("Denim 12oz")).toBe("denim");
  });

  it("a merchant that declared no fallback is served none: the field is absent, not guessed", async () => {
    const settings = await messageSettingsOf(serving(effectiveOf({ supported: ["es-AR"] }))).settingsFor(A);
    expect("fallback" in settings).toBe(false);
  });
});
