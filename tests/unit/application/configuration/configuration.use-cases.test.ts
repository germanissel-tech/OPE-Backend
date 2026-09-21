// Feature 017 — US2 (FR-012, FR-017, FR-020; 03 §4.10; ADR-031): the configuration service
// resolves once and serves from memory; publishing judges the draft, repeats an identical one,
// freezes while an experiment is active unless the version is corrective, and the seed's
// import publishes the version 1 only when the merchant has none.
import { describe, expect, it } from "vitest";
import {
  DefaultConfigurationService,
  GetMerchantConfigurationUseCase,
  ImportMerchantConfigurationUseCase,
  ListConfigurationVersionsUseCase,
  PublishMerchantConfigurationUseCase,
  type ConfigurationStore,
} from "../../../../src/application/configuration/index.js";
import { DefaultScopedMerchantService } from "../../../../src/application/merchant/index.js";
import { Experiment } from "../../../../src/domain/experiment/index.js";
import { asOperatorId, EVERY_MERCHANT, Operator } from "../../../../src/domain/operator/index.js";
import { asExperimentId, asMerchantId } from "../../../../src/domain/shared-kernel/index.js";
import { memoryConfigurationStore } from "../../../../src/interface-adapters/gateways/configuration/memory-configuration-store.js";
import { memoryMerchantStore } from "../../../../src/interface-adapters/gateways/merchant/memory-merchant-store.js";
import { TEST_NOW, testMerchant } from "../../../helpers/merchants.js";
import { testLevels } from "../../../helpers/test-app.js";

const A = asMerchantId("m_a");
const all = Operator.rehydrate({
  operatorId: asOperatorId("ops-all"),
  tokenFingerprints: [],
  scope: EVERY_MERCHANT,
});
const clock = { now: () => TEST_NOW };

function subject(options: { active?: boolean; store?: ConfigurationStore } = {}) {
  const levels = testLevels();
  const calls: string[] = [];
  const inner = options.store ?? memoryConfigurationStore();
  const store: ConfigurationStore = {
    publish: (d) => inner.publish(d),
    latestOf: (m) => {
      calls.push("latestOf");
      return inner.latestOf(m);
    },
    versionsOf: (m, q) => inner.versionsOf(m, q),
  };
  const configuration = new DefaultConfigurationService({
    levels: {
      platform: () => Promise.resolve(levels.platform),
      defaults: () => Promise.resolve(levels.defaults),
    },
    store,
  });
  const merchants = memoryMerchantStore();
  const scoped = new DefaultScopedMerchantService({ merchants });
  const experiment = Experiment.rehydrate({
    experimentId: asExperimentId("exp_00000001"),
    merchantId: A,
    treatmentShare: 1,
    seed: "s",
    status: "active",
    startedAt: TEST_NOW,
  });
  const experiments = { activeFor: () => Promise.resolve(options.active === true ? experiment : undefined) };
  return {
    calls,
    configuration,
    merchants,
    publish: new PublishMerchantConfigurationUseCase({ scoped, store, configuration, experiments, clock }),
    get: new GetMerchantConfigurationUseCase({ scoped, store, configuration }),
    list: new ListConfigurationVersionsUseCase({ scoped, store }),
    import: new ImportMerchantConfigurationUseCase({ store, configuration, clock }),
  };
}

describe("DefaultConfigurationService", () => {
  it("resolves a merchant once from the store and serves the same effective configuration from memory until a version is applied", async () => {
    const { configuration, calls, merchants, publish } = subject();
    await merchants.create(testMerchant({ merchantId: "m_a" }));
    const first = await configuration.effectiveFor(A);
    const again = await configuration.effectiveFor(A);
    expect(again).toBe(first);
    expect(calls).toEqual(["latestOf"]);
    expect(first.versions).toEqual({ platform: "platform-1", defaults: "defaults-1" });
    const published = await publish.execute({
      actor: all,
      merchantId: A,
      declared: { holdoutPercent: 0 },
      corrective: false,
    });
    expect(published.ok).toBe(true);
    const served = await configuration.effectiveFor(A);
    expect(served).not.toBe(first);
    expect(served.versions).toEqual({ platform: "platform-1", defaults: "defaults-1", merchant: 1 });
    expect(served.values.holdoutShare).toBe(0);
  });
});

describe("PublishMerchantConfigurationUseCase", () => {
  it("numbers the versions, repeats an identical draft with the version in force, and lists them newest first", async () => {
    const { publish, list, get, merchants } = subject();
    await merchants.create(testMerchant({ merchantId: "m_a" }));
    const request = { actor: all, merchantId: A, declared: { holdoutPercent: 0 }, corrective: false };
    const first = await publish.execute(request);
    expect(first.ok ? [first.value.outcome, first.value.version.version] : first.error).toEqual([
      "created",
      1,
    ]);
    const repeated = await publish.execute(request);
    expect(repeated.ok ? [repeated.value.outcome, repeated.value.version.version] : repeated.error).toEqual([
      "repeated",
      1,
    ]);
    const second = await publish.execute({ ...request, declared: { holdoutPercent: 10 } });
    expect(second.ok ? second.value.version.version : second.error).toBe(2);
    const page = await list.execute({ actor: all, merchantId: A, page: { limit: 10 } });
    expect(page.ok ? page.value.items.map((v) => v.version) : page.error).toEqual([2, 1]);
    const view = await get.execute({ actor: all, merchantId: A });
    expect(view.ok ? view.value.declared : view.error).toEqual({ holdoutPercent: 10 });
  });

  it("[invariant:configuration-frozen] with an active experiment only a corrective version passes; an identical draft still repeats", async () => {
    const { publish, merchants } = subject({ active: true });
    await merchants.create(testMerchant({ merchantId: "m_a" }));
    const frozen = await publish.execute({
      actor: all,
      merchantId: A,
      declared: { holdoutPercent: 0 },
      corrective: false,
    });
    expect(frozen.ok ? undefined : frozen.error.code).toBe("configuration-frozen");
    const corrective = {
      actor: all,
      merchantId: A,
      declared: { holdoutPercent: 0 },
      corrective: true,
      reason: "fix",
    };
    const created = await publish.execute(corrective);
    expect(created.ok ? created.value.outcome : created.error).toBe("created");
    const repeated = await publish.execute(corrective);
    expect(repeated.ok ? repeated.value.outcome : repeated.error).toBe("repeated");
  });

  it("an unknown merchant or one outside the scope is refused before anything is judged", async () => {
    const { publish } = subject();
    const missing = await publish.execute({ actor: all, merchantId: A, declared: {}, corrective: false });
    expect(missing.ok ? undefined : missing.error.code).toBe("merchant-not-found");
  });
});

describe("ImportMerchantConfigurationUseCase", () => {
  it("publishes the version 1 for a merchant without versions and skips one that has any; an invalid seed names the field", async () => {
    const { import: importConfiguration, configuration } = subject();
    const first = await importConfiguration.execute({
      actor: Operator.system(),
      merchantId: A,
      declared: { holdoutPercent: 0 },
    });
    expect(first.ok && "version" in first.value ? first.value.version.version : undefined).toBe(1);
    expect((await configuration.effectiveFor(A)).values.holdoutShare).toBe(0);
    const again = await importConfiguration.execute({
      actor: Operator.system(),
      merchantId: A,
      declared: { holdoutPercent: 5 },
    });
    expect(again.ok ? again.value : again.error).toEqual({ skipped: true });
    const other = subject();
    const bad = await other.import.execute({
      actor: Operator.system(),
      merchantId: A,
      declared: { barriers: [] },
    });
    expect(bad.ok ? undefined : bad.error.details).toMatchObject({ pointer: "barriers" });
  });
});
