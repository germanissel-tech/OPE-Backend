// Feature 017 — US2 (FR-012, FR-017, FR-020; 03 §4.10; ADR-031): the configuration service
// resolves once and serves from memory; publishing judges the draft, repeats an identical one,
// freezes while an experiment is active unless the version is corrective — which restarts the
// accumulation window (US3, D-G) —, and the seed's import publishes the version 1 only when the
// merchant has none.
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
import { MerchantConfigurationVersion } from "../../../../src/domain/configuration/index.js";
import { asOperatorId, EVERY_MERCHANT, Operator } from "../../../../src/domain/operator/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";
import { memoryConfigurationStore } from "../../../../src/interface-adapters/gateways/configuration/memory-configuration-store.js";
import { memoryExperimentStore } from "../../../../src/interface-adapters/gateways/experiment/memory-experiment-store.js";
import { memoryMerchantStore } from "../../../../src/interface-adapters/gateways/merchant/memory-merchant-store.js";
import { testExperiment } from "../../../helpers/experiments.js";
import { TEST_NOW, testMerchant } from "../../../helpers/merchants.js";
import { testLevels } from "../../../helpers/test-app.js";
import type { ExperimentStatus } from "../../../../src/domain/experiment/index.js";

const A = asMerchantId("m_a");
const all = Operator.rehydrate({
  operatorId: asOperatorId("ops-all"),
  tokenFingerprints: [],
  scope: EVERY_MERCHANT,
});
const clock = { now: () => TEST_NOW };

function subject(options: { status?: ExperimentStatus; store?: ConfigurationStore } = {}) {
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
  const experimentStore = memoryExperimentStore();
  const experiment = testExperiment({
    treatmentShare: 1,
    seed: "s",
    openedAt: TEST_NOW,
    ...(options.status === undefined ? {} : { status: options.status }),
  });
  const experiments = {
    activeFor: () => Promise.resolve(options.status === undefined ? undefined : experiment),
  };
  if (options.status !== undefined) void experimentStore.open(experiment);
  return {
    calls,
    configuration,
    merchants,
    experimentStore,
    experiment,
    publish: new PublishMerchantConfigurationUseCase({
      scoped,
      store,
      configuration,
      experiments,
      experimentStore,
      clock,
    }),
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
    const { publish, merchants } = subject({ status: "active" });
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

  it("a corrective version restarts the accumulation window of the active experiment with the version and the reason (D-G)", async () => {
    const { publish, merchants, experimentStore, experiment } = subject({ status: "active" });
    await merchants.create(testMerchant({ merchantId: "m_a" }));
    const created = await publish.execute({
      actor: all,
      merchantId: A,
      declared: { holdoutPercent: 0 },
      corrective: true,
      reason: "anchor fix",
    });
    expect(created.ok ? [created.value.outcome, created.value.windowRestarted] : created.error).toEqual([
      "created",
      true,
    ]);
    const restarted = await experimentStore.get(A, experiment.experimentId);
    expect(restarted?.record()).toMatchObject({
      status: "active",
      windowStartedAt: TEST_NOW,
      windowRestarts: [{ at: TEST_NOW, reason: "anchor fix", configurationVersion: 1 }],
    });
    // Repeating it restarts nothing.
    const repeated = await publish.execute({
      actor: all,
      merchantId: A,
      declared: { holdoutPercent: 0 },
      corrective: true,
      reason: "anchor fix",
    });
    expect(repeated.ok ? repeated.value.windowRestarted : repeated.error).toBe(false);
    expect((await experimentStore.get(A, experiment.experimentId))?.windowRestarts).toHaveLength(1);
  });

  it("while the experiment calibrates nothing freezes and nothing restarts, corrective or not (03 §4.10)", async () => {
    const { publish, merchants, experimentStore, experiment } = subject({ status: "calibrating" });
    await merchants.create(testMerchant({ merchantId: "m_a" }));
    const plain = await publish.execute({
      actor: all,
      merchantId: A,
      declared: { holdoutPercent: 0 },
      corrective: false,
    });
    expect(plain.ok ? [plain.value.outcome, plain.value.windowRestarted] : plain.error).toEqual([
      "created",
      false,
    ]);
    const corrective = await publish.execute({
      actor: all,
      merchantId: A,
      declared: { holdoutPercent: 5 },
      corrective: true,
      reason: "early",
    });
    expect(
      corrective.ok ? [corrective.value.outcome, corrective.value.windowRestarted] : corrective.error,
    ).toEqual(["created", false]);
    expect((await experimentStore.get(A, experiment.experimentId))?.record()).toMatchObject({
      status: "calibrating",
      windowRestarts: [],
    });
  });

  it("a store that numbers a corrective version without its reason is a programming error, not a business outcome", async () => {
    const inner = memoryConfigurationStore();
    const forgetful: ConfigurationStore = {
      publish: async (draft) => {
        const published = await inner.publish(draft);
        if (!published.ok) return published;
        const { reason, ...rest } = published.value.record();
        expect(reason).toBe("anchor fix");
        return { ok: true, value: MerchantConfigurationVersion.rehydrate(rest) };
      },
      latestOf: (m) => inner.latestOf(m),
      versionsOf: (m, q) => inner.versionsOf(m, q),
    };
    const { publish, merchants } = subject({ status: "active", store: forgetful });
    await merchants.create(testMerchant({ merchantId: "m_a" }));
    await expect(
      publish.execute({
        actor: all,
        merchantId: A,
        declared: { holdoutPercent: 0 },
        corrective: true,
        reason: "anchor fix",
      }),
    ).rejects.toThrow("A corrective version carries a reason.");
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
