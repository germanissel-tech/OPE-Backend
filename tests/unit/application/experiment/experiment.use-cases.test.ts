// Feature 017 — US3 (03 §4.10, D-G; ADR-022; ADR-031): the use cases of the experiment — open in
// calibration within the holdout and the scope, activate, close, list — and the seed's import;
// the store judges the set of the merchant and answers the open one to the assignment.
import { describe, expect, it } from "vitest";
import {
  ActivateExperimentUseCase,
  CloseExperimentUseCase,
  CreateExperimentUseCase,
  ScopedExperiments,
  ImportExperimentsUseCase,
  ListExperimentsUseCase,
  type ExperimentStore,
} from "../../../../src/application/experiment/index.js";
import { ScopedMerchants } from "../../../../src/application/merchant/index.js";
import { asOperatorId, EVERY_MERCHANT, Operator } from "../../../../src/domain/operator/index.js";
import {
  asExperimentId,
  asMerchantId,
  fail,
  StoreUnavailable,
} from "../../../../src/domain/shared-kernel/index.js";
import { memoryExperimentStore } from "../../../../src/interface-adapters/experiment/gateways/memory-experiment-store.js";
import { memoryMerchantStore } from "../../../../src/interface-adapters/merchant/gateways/memory-merchant-store.js";
import { testExperiment } from "../../../helpers/experiments.js";
import { TEST_NOW, testMerchant } from "../../../helpers/merchants.js";

const A = asMerchantId("m_a");
const B = asMerchantId("m_b");
const all = Operator.rehydrate({
  operatorId: asOperatorId("ops-all"),
  tokenFingerprints: [],
  scope: EVERY_MERCHANT,
});
const onlyB = Operator.rehydrate({ operatorId: asOperatorId("ops-b"), tokenFingerprints: [], scope: [B] });
const LATER = new Date(TEST_NOW.getTime() + 60_000);

const OPENING = { treatmentShare: 0.5, seed: "pilot", targetSample: 1000, cuts: [33, 66] };

async function subject(options: { holdoutShare?: number; store?: ExperimentStore } = {}) {
  let now = TEST_NOW;
  const clock = { now: () => now };
  const merchants = memoryMerchantStore();
  await merchants.create(testMerchant({ merchantId: "m_a" }));
  const scoped = new ScopedMerchants({ merchants });
  const experiments = options.store ?? memoryExperimentStore();
  let minted = 0;
  const minter = {
    mintExperimentId: () => Promise.resolve(asExperimentId(`exp_${String(++minted).padStart(8, "0")}`)),
  };
  const holdout = { holdoutShareFor: () => Promise.resolve(options.holdoutShare ?? 0) };
  const scopedExperiment = new ScopedExperiments({ scoped, experiments });
  return {
    experiments,
    tick: (at: Date) => {
      now = at;
    },
    create: new CreateExperimentUseCase({ scoped, experiments, holdout, minter, clock }),
    activate: new ActivateExperimentUseCase({ scoped: scopedExperiment, experiments, clock }),
    close: new CloseExperimentUseCase({ scoped: scopedExperiment, experiments, clock }),
    list: new ListExperimentsUseCase({ scoped, experiments }),
    import: new ImportExperimentsUseCase({ experiments }),
  };
}

describe("CreateExperimentUseCase", () => {
  it("opens the experiment in calibration with a minted identifier and the clock's instant; the directory answers it", async () => {
    const { create, experiments } = await subject();
    const created = await create.execute({ actor: all, merchantId: A, ...OPENING });
    if (!created.ok) throw new Error(created.error.message);
    expect(created.value.record()).toMatchObject({
      experimentId: "exp_00000001",
      merchantId: A,
      status: "calibrating",
      treatmentShare: 0.5,
      seed: "pilot",
      targetSample: 1000,
      cuts: [33, 66],
      openedAt: TEST_NOW,
      windowRestarts: [],
    });
    const memory = experiments as ExperimentStore & { activeFor(m: typeof A): Promise<unknown> };
    expect(await memory.activeFor(A)).toBe(created.value);
    expect(await experiments.get(A, asExperimentId("exp_00000001"))).toBe(created.value);
  });

  it("[invariant:experiment-already-open] a second one while the first is open is refused; after closing, it opens", async () => {
    const { create, close } = await subject();
    const first = await create.execute({ actor: all, merchantId: A, ...OPENING });
    if (!first.ok) throw new Error(first.error.message);
    const second = await create.execute({ actor: all, merchantId: A, ...OPENING });
    expect(second.ok ? undefined : second.error.code).toBe("experiment-already-open");
    await close.execute({ actor: all, merchantId: A, experimentId: first.value.experimentId });
    const third = await create.execute({ actor: all, merchantId: A, ...OPENING });
    expect(third.ok ? third.value.experimentId : third.error).toBe("exp_00000003");
  });

  it("[invariant:treatment-exceeds-holdout] the split is judged against the holdout the configuration resolves", async () => {
    const { create } = await subject({ holdoutShare: 0.05 });
    const exceeds = await create.execute({ actor: all, merchantId: A, ...OPENING, treatmentShare: 0.96 });
    expect(exceeds.ok ? undefined : exceeds.error.code).toBe("treatment-exceeds-holdout");
    const fits = await create.execute({ actor: all, merchantId: A, ...OPENING, treatmentShare: 0.95 });
    expect(fits.ok).toBe(true);
  });

  it("the rules of the entity come before the holdout and the store: cuts and target sample name their error", async () => {
    const { create } = await subject();
    const cuts = await create.execute({ actor: all, merchantId: A, ...OPENING, cuts: [66, 33] });
    expect(cuts.ok ? undefined : cuts.error.code).toBe("invalid-experiment-cuts");
    const target = await create.execute({ actor: all, merchantId: A, ...OPENING, targetSample: 0 });
    expect(target.ok ? undefined : target.error.code).toBe("invalid-target-sample");
    const share = await create.execute({ actor: all, merchantId: A, ...OPENING, treatmentShare: 2 });
    expect(share.ok ? undefined : share.error.code).toBe("invalid-treatment-share");
  });

  it("an unknown merchant or one outside the scope is refused before anything is minted; a store down is 503", async () => {
    const { create } = await subject();
    const missing = await create.execute({ actor: all, merchantId: B, ...OPENING });
    expect(missing.ok ? undefined : missing.error.code).toBe("merchant-not-found");
    const denied = await create.execute({ actor: onlyB, merchantId: A, ...OPENING });
    expect(denied.ok ? undefined : denied.error.code).toBe("merchant-out-of-scope");
    const down: ExperimentStore = {
      open: () => Promise.resolve(fail(new StoreUnavailable())),
      update: () => Promise.resolve(fail(new StoreUnavailable())),
      get: () => Promise.resolve(undefined),
      listOf: () => Promise.resolve({ items: [] }),
    };
    const { create: createDown } = await subject({ store: down });
    const unavailable = await createDown.execute({ actor: all, merchantId: A, ...OPENING });
    expect(unavailable.ok ? undefined : unavailable.error.code).toBe("store-unavailable");
  });
});

describe("ActivateExperimentUseCase and CloseExperimentUseCase", () => {
  it("activates from calibration at the clock's instant, repeats an active one unchanged, and refuses a closed one", async () => {
    const { create, activate, close, tick, experiments } = await subject();
    const created = await create.execute({ actor: all, merchantId: A, ...OPENING });
    if (!created.ok) throw new Error(created.error.message);
    const id = created.value.experimentId;
    tick(LATER);
    const active = await activate.execute({ actor: all, merchantId: A, experimentId: id });
    expect(active.ok ? active.value.record() : active.error).toMatchObject({
      status: "active",
      activatedAt: LATER,
      windowStartedAt: LATER,
    });
    expect(await experiments.get(A, id)).toBe(active.ok ? active.value : undefined);
    const again = await activate.execute({ actor: all, merchantId: A, experimentId: id });
    expect(again.ok && again.value).toBe(active.ok ? active.value : undefined);
    const closed = await close.execute({ actor: all, merchantId: A, experimentId: id });
    expect(closed.ok ? closed.value.record() : closed.error).toMatchObject({
      status: "closed",
      closedAt: LATER,
    });
    const reopened = await activate.execute({ actor: all, merchantId: A, experimentId: id });
    expect(reopened.ok ? undefined : reopened.error.code).toBe("experiment-not-open");
    const closedAgain = await close.execute({ actor: all, merchantId: A, experimentId: id });
    expect(closedAgain.ok && closedAgain.value).toBe(closed.ok ? closed.value : undefined);
  });

  it("an unknown experiment is experiment-not-found; the scope is judged first", async () => {
    const { activate, close } = await subject();
    const unknown = asExperimentId("exp_unknown_1");
    const missing = await activate.execute({ actor: all, merchantId: A, experimentId: unknown });
    expect(missing.ok ? undefined : missing.error.code).toBe("experiment-not-found");
    const closing = await close.execute({ actor: all, merchantId: A, experimentId: unknown });
    expect(closing.ok ? undefined : closing.error.code).toBe("experiment-not-found");
    const denied = await activate.execute({ actor: onlyB, merchantId: A, experimentId: unknown });
    expect(denied.ok ? undefined : denied.error.code).toBe("merchant-out-of-scope");
  });
});

describe("ListExperimentsUseCase", () => {
  it("lists the experiments of the merchant newest first, paged; nothing of another merchant", async () => {
    const { create, close, list } = await subject();
    const first = await create.execute({ actor: all, merchantId: A, ...OPENING });
    if (!first.ok) throw new Error(first.error.message);
    await close.execute({ actor: all, merchantId: A, experimentId: first.value.experimentId });
    await create.execute({ actor: all, merchantId: A, ...OPENING });
    const page = await list.execute({ actor: all, merchantId: A, page: { limit: 1 } });
    expect(page.ok ? page.value.items.map((e) => e.experimentId) : page.error).toEqual(["exp_00000002"]);
    expect(page.ok && page.value.nextCursor).toBeDefined();
    const denied = await list.execute({ actor: onlyB, merchantId: A, page: { limit: 10 } });
    expect(denied.ok ? undefined : denied.error.code).toBe("merchant-out-of-scope");
  });
});

describe("ImportExperimentsUseCase", () => {
  it("records the experiments of the seed for a merchant without any, and skips one that has any", async () => {
    const { import: importExperiments, experiments } = await subject();
    const closed = testExperiment({ experimentId: "exp_seed_0001", status: "closed" });
    const active = testExperiment({ experimentId: "exp_seed_0002", status: "active" });
    const imported = await importExperiments.execute({
      actor: Operator.system(),
      merchantId: A,
      experiments: [closed, active],
    });
    expect(imported.ok ? imported.value : imported.error).toEqual({ imported: 2 });
    expect((await experiments.listOf(A, { limit: 10 })).items.map((e) => e.experimentId)).toEqual([
      "exp_seed_0002",
      "exp_seed_0001",
    ]);
    const again = await importExperiments.execute({
      actor: Operator.system(),
      merchantId: A,
      experiments: [active],
    });
    expect(again.ok ? again.value : again.error).toEqual({ skipped: true });
    // A seed that breaks the rule of the set is refused by the store.
    const other = await subject();
    const two = await other.import.execute({
      actor: Operator.system(),
      merchantId: A,
      experiments: [active, testExperiment({ experimentId: "exp_seed_0003", status: "calibrating" })],
    });
    expect(two.ok ? undefined : two.error.code).toBe("experiment-already-open");
  });
});

describe("memoryExperimentStore", () => {
  it("updating an experiment that was never opened is a programming error", async () => {
    const store = memoryExperimentStore();
    await expect(store.update(testExperiment())).rejects.toThrow("was never opened");
  });

  it("with several experiments of the merchant, get and update act on the one with the identifier and leave the rest as they are", async () => {
    const store = memoryExperimentStore();
    const first = testExperiment({ experimentId: "exp_00000001", status: "closed" });
    const second = testExperiment({ experimentId: "exp_00000002", status: "calibrating" });
    await store.open(first);
    await store.open(second);
    expect(await store.get(A, asExperimentId("exp_00000002"))).toBe(second);
    expect(await store.get(A, asExperimentId("exp_00000001"))).toBe(first);
    expect(await store.get(A, asExperimentId("exp_00000003"))).toBeUndefined();
    const activated = second.activated(LATER);
    if (!activated.ok) throw new Error(activated.error.message);
    await store.update(activated.value);
    expect((await store.listOf(A, { limit: 10 })).items).toEqual([activated.value, first]);
    expect(await store.activeFor(A)).toBe(activated.value);
  });
});
