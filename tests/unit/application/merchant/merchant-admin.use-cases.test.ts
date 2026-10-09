// Feature 017 — US1 (FR-001..FR-009): the administration use cases of a merchant against the
// in-memory store — creation mints and answers once, rotation with grace, kill switch,
// deactivation, scope, and the import of the seed into an empty store only.
import { describe, expect, it } from "vitest";
import {
  CreateMerchantUseCase,
  DeactivateMerchantUseCase,
  ScopedMerchants,
  GetMerchantUseCase,
  ImportMerchantsUseCase,
  ListMerchantsUseCase,
  RotateCredentialUseCase,
  SetKillSwitchUseCase,
  UpdateMerchantProfileUseCase,
  type MerchantSeed,
} from "../../../../src/application/merchant/index.js";
import { asOperatorId, EVERY_MERCHANT, Operator } from "../../../../src/domain/operator/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";
import { memoryMerchantStore } from "../../../../src/interface-adapters/merchant/gateways/memory-merchant-store.js";
import { fakeMinter, fingerprintOf, TEST_NOW, testMerchant } from "../../../helpers/merchants.js";

const HOUR = 3_600_000;
const all = Operator.rehydrate({
  operatorId: asOperatorId("ops-all"),
  tokenFingerprints: ["f"],
  scope: EVERY_MERCHANT,
});
const onlyA = Operator.rehydrate({
  operatorId: asOperatorId("ops-a"),
  tokenFingerprints: ["g"],
  scope: [asMerchantId("m_a")],
});
const clock = { now: () => TEST_NOW };
const rotation = { maxGraceMs: () => Promise.resolve(HOUR) };
/** Every creation names the merchant (feature 041). */
const NAMED = { displayName: "New" };

function subject() {
  const store = memoryMerchantStore();
  const scoped = new ScopedMerchants({ merchants: store });
  return {
    store,
    create: new CreateMerchantUseCase({ merchants: store, minter: fakeMinter, clock }),
    get: new GetMerchantUseCase({ scoped }),
    list: new ListMerchantsUseCase({ merchants: store }),
    rotate: new RotateCredentialUseCase({ scoped, merchants: store, minter: fakeMinter, rotation, clock }),
    kill: new SetKillSwitchUseCase({ scoped, merchants: store }),
    deactivate: new DeactivateMerchantUseCase({ scoped, merchants: store }),
    import: new ImportMerchantsUseCase({ merchants: store, minter: fakeMinter, clock }),
    update: new UpdateMerchantProfileUseCase({ scoped, merchants: store }),
  };
}

const seedA: MerchantSeed = {
  merchantId: "m_a",
  ingestKeys: ["key-a-1"],
  origins: ["https://a.example"],
  platformKeys: ["platform-a-1"],
  platformSecrets: ["secret-a"],
};

describe("CreateMerchantUseCase", () => {
  it("mints the id and the credentials, answers their values once and the store keeps fingerprints only", async () => {
    const { create, store } = subject();
    const r = await create.execute({
      actor: all,
      origins: ["https://new.example"],
      signature: true,
      profile: NAMED,
    });
    if (!r.ok) throw new Error(r.error.code);
    expect(r.value.merchant.merchantId).toMatch(/^mrc_minted\d{6}$/);
    expect(r.value.ingestKey).toMatch(/^ingest-value-/);
    expect(r.value.platformKey).toMatch(/^platform-value-/);
    expect(r.value.platformSecret).toMatch(/^signing-value-/);
    const kept = await store.get(r.value.merchant.merchantId);
    expect(kept?.credentials.map((c) => c.kind)).toEqual(["ingest", "platform", "signing"]);
    expect(kept?.owns(fingerprintOf(r.value.ingestKey), TEST_NOW)).toBe(true);
    expect(kept?.credentials.map((c) => c.fingerprint)).not.toContain(r.value.ingestKey);
    expect(kept?.credentials.filter((c) => c.secret !== undefined).map((c) => c.kind)).toEqual(["signing"]);
    expect(kept?.signingSecrets(TEST_NOW)).toEqual([r.value.platformSecret]);
    expect(await store.findByIngestKey(fingerprintOf(r.value.ingestKey), TEST_NOW)).toBe(kept);
  });

  it("without signature no secret is minted; the merchant does not require signatures", async () => {
    const { create } = subject();
    const r = await create.execute({
      actor: all,
      origins: ["https://new.example"],
      signature: false,
      profile: NAMED,
    });
    if (!r.ok) throw new Error(r.error.code);
    expect(r.value.platformSecret).toBeUndefined();
    expect(r.value.merchant.requiresSignature(TEST_NOW)).toBe(false);
  });

  it("[invariant:origin-already-registered] an origin of another merchant (even a deactivated one) is refused naming its index", async () => {
    const { create, store, deactivate } = subject();
    await store.create(testMerchant({ merchantId: "m_a", origins: ["https://a.example"] }));
    const r = await create.execute({
      actor: all,
      origins: ["https://new.example", "https://A.example"],
      signature: false,
      profile: NAMED,
    });
    expect(r.ok ? undefined : [r.error.code, r.error.details]).toEqual([
      "origin-already-registered",
      { index: 1, pointer: "origins[1]" },
    ]);
    await deactivate.execute({ actor: all, merchantId: asMerchantId("m_a") });
    const again = await create.execute({
      actor: all,
      origins: ["https://a.example"],
      signature: false,
      profile: NAMED,
    });
    expect(again.ok ? undefined : again.error.code).toBe("origin-already-registered");
  });

  it("[invariant:invalid-origin] an origin that is not one is refused before anything is minted", async () => {
    const { create, store } = subject();
    const r = await create.execute({
      actor: all,
      origins: ["not an origin"],
      signature: false,
      profile: NAMED,
    });
    expect(r.ok ? undefined : r.error.code).toBe("invalid-origin");
    expect(await store.isEmpty()).toBe(true);
  });
});

// Feature 041 (ADR-045): the identity at creation and its replacement.
describe("the identity of a merchant", () => {
  const identity = {
    displayName: "Tienda Norte",
    storeUrl: "https://norte.example",
    contact: { name: "Ana", email: "ana@norte.example", role: "owner" },
    notes: "Pilot.",
  };

  it("creation keeps the identity as written", async () => {
    const { create, store } = subject();
    const r = await create.execute({
      actor: all,
      origins: ["https://norte.example"],
      signature: false,
      profile: identity,
    });
    if (!r.ok) throw new Error(r.error.code);
    expect(r.value.merchant.profile?.record()).toEqual(identity);
    expect((await store.get(r.value.merchant.merchantId))?.profile?.record()).toEqual(identity);
  });

  it("[invariant:invalid-merchant-profile] creation with a padded name is refused before asking the store or minting anything", async () => {
    const { store } = subject();
    let asked = 0;
    const counting = {
      ...store,
      ownerOfOrigin: (origin: string) => ((asked += 1), store.ownerOfOrigin(origin)),
    };
    const spy = new CreateMerchantUseCase({ merchants: counting, minter: fakeMinter, clock });
    const r = await spy.execute({
      actor: all,
      origins: ["https://norte.example"],
      signature: false,
      profile: { displayName: " Tienda " },
    });
    expect(r.ok ? undefined : [r.error.code, r.error.details["pointer"]]).toEqual([
      "invalid-merchant-profile",
      "displayName",
    ]);
    expect(asked).toBe(0);
    expect(await store.isEmpty()).toBe(true);
  });

  it("the replacement writes the merchant with the identity whole, and answers it", async () => {
    const { update, store } = subject();
    await store.create(testMerchant({ merchantId: "m_a" }));
    const r = await update.execute({ actor: all, merchantId: asMerchantId("m_a"), profile: identity });
    if (!r.ok) throw new Error(r.error.code);
    expect(r.value.profile?.record()).toEqual(identity);
    expect((await store.get(asMerchantId("m_a")))?.profile?.record()).toEqual(identity);
    const less = await update.execute({
      actor: all,
      merchantId: asMerchantId("m_a"),
      profile: { displayName: "Norte" },
    });
    expect(less.ok ? less.value.profile?.record() : undefined).toEqual({ displayName: "Norte" });
  });

  it("the replacement refuses a merchant outside the scope, and an invalid identity, without writing", async () => {
    const { update, store } = subject();
    await store.create(testMerchant({ merchantId: "m_b", origins: ["https://b.example"] }));
    const scoped = await update.execute({ actor: onlyA, merchantId: asMerchantId("m_b"), profile: identity });
    expect(scoped.ok ? undefined : scoped.error.code).toBe("merchant-out-of-scope");
    const missing = await update.execute({
      actor: all,
      merchantId: asMerchantId("m_nobody"),
      profile: identity,
    });
    expect(missing.ok ? undefined : missing.error.code).toBe("merchant-not-found");
    const bad = await update.execute({
      actor: all,
      merchantId: asMerchantId("m_b"),
      profile: { displayName: "X", storeUrl: "https://" },
    });
    expect(bad.ok ? undefined : [bad.error.code, bad.error.details["pointer"]]).toEqual([
      "invalid-merchant-profile",
      "storeUrl",
    ]);
    expect((await store.get(asMerchantId("m_b")))?.profile).toBeUndefined();
  });

  it("a deactivated merchant admits the replacement", async () => {
    const { update, deactivate, store } = subject();
    await store.create(testMerchant({ merchantId: "m_a" }));
    await deactivate.execute({ actor: all, merchantId: asMerchantId("m_a") });
    const r = await update.execute({
      actor: all,
      merchantId: asMerchantId("m_a"),
      profile: { displayName: "Cerrada" },
    });
    expect(r.ok ? [r.value.isDeactivated(), r.value.profile?.displayName] : r.error.code).toEqual([
      true,
      "Cerrada",
    ]);
  });

  it("the seed brings an identity through the same door, and a bad one stops the import", async () => {
    const { import: importSeeds, store } = subject();
    const r = await importSeeds.execute({
      actor: all,
      seeds: [{ ...seedA, displayName: "Semilla", storeUrl: "https://a.example" }],
    });
    expect(r.ok ? r.value : r.error.code).toEqual({ imported: 1 });
    // A seed without identity imports a merchant without one: not an empty identity.
    const { import: plain, store: plainStore } = subject();
    await plain.execute({ actor: all, seeds: [seedA] });
    expect((await plainStore.get(asMerchantId("m_a")))?.profile).toBeUndefined();
    expect((await store.get(asMerchantId("m_a")))?.profile?.record()).toEqual({
      displayName: "Semilla",
      storeUrl: "https://a.example",
    });
    const { import: again, store: empty } = subject();
    const bad = await again.execute({ actor: all, seeds: [{ ...seedA, notes: " " }] });
    expect(bad.ok ? undefined : [bad.error.code, bad.error.details["pointer"]]).toEqual([
      "invalid-merchant-profile",
      "notes",
    ]);
    expect(await empty.isEmpty()).toBe(true);
  });
});

describe("scope (FR-007)", () => {
  it("get, rotate, switch and deactivate refuse a merchant outside the scope without touching the store, existing or not", async () => {
    const { get, rotate, kill, deactivate, store } = subject();
    await store.create(testMerchant({ merchantId: "m_b" }));
    for (const id of ["m_b", "m_nobody"]) {
      const merchantId = asMerchantId(id);
      const outcomes = await Promise.all([
        get.execute({ actor: onlyA, merchantId }),
        rotate.execute({ actor: onlyA, merchantId, kind: "ingest", graceMs: 0 }),
        kill.execute({ actor: onlyA, merchantId, enabled: false }),
        deactivate.execute({ actor: onlyA, merchantId }),
      ]);
      expect(outcomes.map((o) => (o.ok ? "ok" : o.error.code))).toEqual(
        Array<string>(4).fill("merchant-out-of-scope"),
      );
    }
    expect((await store.get(asMerchantId("m_b")))?.status).toBe("active");
  });

  it("within the scope a missing merchant is not found; list shows only the scope", async () => {
    const { get, list, store } = subject();
    await store.create(testMerchant({ merchantId: "m_a" }));
    await store.create(testMerchant({ merchantId: "m_b", origins: ["https://b.example"] }));
    const missing = await get.execute({ actor: all, merchantId: asMerchantId("m_zzz") });
    expect(missing.ok ? undefined : missing.error.code).toBe("merchant-not-found");
    expect((await list.execute({ actor: onlyA, limit: 10 })).items.map((m) => m.merchantId)).toEqual(["m_a"]);
    expect((await list.execute({ actor: all, limit: 10 })).items.map((m) => m.merchantId)).toEqual([
      "m_a",
      "m_b",
    ]);
  });
});

describe("RotateCredentialUseCase (FR-004)", () => {
  const A = asMerchantId("m_a");

  it("mints a credential of the kind, answers it once and gives the previous one the grace", async () => {
    const { rotate, store } = subject();
    await store.create(testMerchant({ merchantId: "m_a", ingestKeys: ["old"] }));
    const r = await rotate.execute({ actor: all, merchantId: A, kind: "ingest", graceMs: HOUR });
    if (!r.ok) throw new Error(r.error.code);
    expect(r.value.kind).toBe("ingest");
    expect(r.value.previousExpiresAt).toEqual(new Date(TEST_NOW.getTime() + HOUR));
    const kept = await store.get(A);
    expect(kept?.owns(fingerprintOf("old"), TEST_NOW)).toBe(true);
    expect(kept?.owns(fingerprintOf("old"), new Date(TEST_NOW.getTime() + HOUR))).toBe(false);
    expect(kept?.owns(fingerprintOf(r.value.value), TEST_NOW)).toBe(true);
    expect(kept?.credentials.every((c) => c.secret === undefined)).toBe(true);
  });

  it("a signing secret is kept with its value; the first one of a kind has no previous expiry", async () => {
    const { rotate, store } = subject();
    await store.create(testMerchant({ merchantId: "m_a" }));
    const r = await rotate.execute({ actor: all, merchantId: A, kind: "signing", graceMs: 0 });
    if (!r.ok) throw new Error(r.error.code);
    expect(r.value.previousExpiresAt).toBeUndefined();
    expect((await store.get(A))?.signingSecrets(TEST_NOW)).toEqual([r.value.value]);
  });

  it("[invariant:rotation-grace-too-long] a grace beyond the platform maximum is refused and nothing changes", async () => {
    const { rotate, store } = subject();
    await store.create(testMerchant({ merchantId: "m_a", ingestKeys: ["old"] }));
    const r = await rotate.execute({ actor: all, merchantId: A, kind: "ingest", graceMs: HOUR + 1 });
    expect(r.ok ? undefined : r.error.code).toBe("rotation-grace-too-long");
    expect((await store.get(A))?.credentials).toHaveLength(1);
  });
});

describe("SetKillSwitchUseCase and DeactivateMerchantUseCase (FR-005, FR-006)", () => {
  const A = asMerchantId("m_a");

  it("off then on, without losing anything; deactivated is terminal and refuses the switch and rotations", async () => {
    const { kill, deactivate, rotate, store, get } = subject();
    await store.create(testMerchant({ merchantId: "m_a", ingestKeys: ["k"] }));
    const off = await kill.execute({ actor: all, merchantId: A, enabled: false });
    expect(off.ok && off.value.isOn()).toBe(false);
    expect(await store.findByIngestKey(fingerprintOf("k"), TEST_NOW)).toBeDefined();
    const on = await kill.execute({ actor: all, merchantId: A, enabled: true });
    expect(on.ok && on.value.isOn()).toBe(true);
    const gone = await deactivate.execute({ actor: all, merchantId: A });
    expect(gone.ok && gone.value.status).toBe("deactivated");
    expect(await store.findByIngestKey(fingerprintOf("k"), TEST_NOW)).toBeUndefined();
    expect(await store.isRegisteredOrigin("https://a.example")).toBe(false);
    const again = await deactivate.execute({ actor: all, merchantId: A });
    expect(again.ok && again.value.status).toBe("deactivated");
    const switched = await kill.execute({ actor: all, merchantId: A, enabled: true });
    expect(switched.ok ? undefined : switched.error.code).toBe("merchant-deactivated");
    const rotated = await rotate.execute({ actor: all, merchantId: A, kind: "ingest", graceMs: 0 });
    expect(rotated.ok ? undefined : rotated.error.code).toBe("merchant-deactivated");
    expect((await get.execute({ actor: all, merchantId: A })).ok).toBe(true);
  });
});

describe("ImportMerchantsUseCase (FR-009)", () => {
  it("an empty store imports the seed with the keys the seed brings, fingerprinted; a full one skips it", async () => {
    const { import: importer, store } = subject();
    const first = await importer.execute({ actor: Operator.system(), seeds: [seedA] });
    expect(first.ok && first.value).toEqual({ imported: 1 });
    const kept = await store.get(asMerchantId("m_a"));
    expect(kept?.owns(fingerprintOf("key-a-1"), TEST_NOW)).toBe(true);
    expect(kept?.ownsPlatformKey(fingerprintOf("platform-a-1"), TEST_NOW)).toBe(true);
    expect(kept?.signingSecrets(TEST_NOW)).toEqual(["secret-a"]);
    const second = await importer.execute({
      actor: Operator.system(),
      seeds: [{ ...seedA, merchantId: "m_other" }],
    });
    expect(second.ok && second.value).toEqual({ skipped: true });
    expect(await store.get(asMerchantId("m_other"))).toBeUndefined();
  });

  it("a seed the entity rejects fails naming the rule and imports nothing after it", async () => {
    const { import: importer, store } = subject();
    const r = await importer.execute({ actor: Operator.system(), seeds: [{ ...seedA, origins: [] }] });
    expect(r.ok ? undefined : r.error.code).toBe("invalid-origins");
    expect(await store.isEmpty()).toBe(true);
  });
});
