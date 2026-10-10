// The merchants across a restart (feature 033, US1). What the `fast` suite proves is that the store
// behaves; what only shows up here is that a merchant an operator created through the API **still
// authenticates** after the process that created it is gone.
//
// **And that is the assertion that matters, not that it exists.** A merchant read back from the store
// lists fine and looks fine in the panel even if its origins came back as plain objects; what fails then
// is the CORS edge, in another request, with no apparent connection. `Origin` is a class with `equals`
// and `JSON.parse` does not return classes, so this suite asks `allowsOrigin` and the lookup by
// fingerprint rather than the listing.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Merchant, MerchantProfile } from "../../src/domain/merchant/index.js";
import { asMerchantId, hours } from "../../src/domain/shared-kernel/index.js";
import { memoryMerchantStore, sqliteMerchantStore } from "../../src/interface-adapters/merchant/index.js";
import { fingerprintOf, testMerchant } from "../helpers/merchants.js";
import { restartableStore, type Restartable } from "./store-fixture.js";
import type { MerchantDirectory, MerchantStore } from "../../src/application/merchant/index.js";

const NOW = new Date("2026-09-29T10:00:00.000Z");
const later = (ms: number): Date => new Date(NOW.getTime() + ms);

let fixture: Restartable;

beforeEach(() => {
  fixture = restartableStore();
});

afterEach(() => {
  fixture.dispose();
});

/** A store over the current connection. After `restart()` this is a different one over the same file. */
const merchants = (): MerchantStore & MerchantDirectory =>
  sqliteMerchantStore({ store: fixture.store, logger: fixture.logger, index: memoryMerchantStore() });

describe("the merchants across a restart", () => {
  it("starts on an empty store, and an empty store is a valid store", async () => {
    // The seed reads this to decide whether to import, so getting it wrong means importing over
    // somebody's merchants or never importing at all.
    expect(await merchants().isEmpty()).toBe(true);
  });

  it("authenticates with the credential issued before the restart", async () => {
    const merchant = testMerchant({
      merchantId: "m_uno",
      ingestKeys: ["key-1"],
      origins: ["https://uno.example"],
    });
    expect(await merchants().create(merchant)).toEqual({ ok: true, value: undefined });

    fixture.restart();

    const after = merchants();
    const found = await after.findByIngestKey(fingerprintOf("key-1"), NOW);
    expect(found?.merchantId).toBe("m_uno");
    // The assertion that catches an origin that came back as a plain object: `allowsOrigin` compares
    // with `Origin.equals`, so an unrehydrated origin throws instead of answering.
    expect(found?.allowsOrigin("https://uno.example")).toBe(true);
    expect(await after.isRegisteredOrigin("https://uno.example")).toBe(true);
    expect(await after.ownerOfOrigin("https://uno.example")).toBe("m_uno");
  });

  it("keeps a deactivated merchant deactivated, and its origins reserved", async () => {
    const merchant = testMerchant({ merchantId: "m_dos", origins: ["https://dos.example"] });
    await merchants().create(merchant.deactivated());

    fixture.restart();

    const after = merchants();
    expect((await after.get(asMerchantId("m_dos")))?.isDeactivated()).toBe(true);
    // `ownerOfOrigin` reaches the deactivated ones — that is what keeps the origin reserved — and
    // `isRegisteredOrigin` does not, because CORS must not answer for a merchant that is gone.
    expect(await after.ownerOfOrigin("https://dos.example")).toBe("m_dos");
    expect(await after.isRegisteredOrigin("https://dos.example")).toBe(false);
  });

  it("refuses an origin another merchant already registered, after the restart too", async () => {
    // The only uniqueness of this schema that is **between** merchants, and the store is what enforces
    // it: a read before the write would be the race `01 §6` forbids.
    await merchants().create(testMerchant({ merchantId: "m_tres", origins: ["https://compartido.example"] }));

    fixture.restart();

    const clash = testMerchant({ merchantId: "m_cuatro", origins: ["https://compartido.example"] });
    const refused = await merchants().create(clash);
    expect(refused.ok).toBe(false);
    expect(refused.ok ? undefined : refused.error.code).toBe("store-unavailable");
    // And nothing of the refused merchant was left behind: the origin still belongs to the first.
    expect(await merchants().ownerOfOrigin("https://compartido.example")).toBe("m_tres");
    expect(await merchants().get(asMerchantId("m_cuatro"))).toBeUndefined();
  });

  it("carries the expiry of a rotated credential as an instant, not as a timer", async () => {
    // A grace that ran out while the server was down must not authenticate when it comes back. The
    // expiry is an instant in the record, so the answer depends on `now` and not on how long the
    // process has been up.
    const merchant = testMerchant({ merchantId: "m_cinco", ingestKeys: ["vieja"] });
    const rotated = merchant.rotated(
      Merchant.credential("ingest", fingerprintOf("nueva"), NOW),
      { graceMs: hours(1), maxGraceMs: hours(168) },
      NOW,
    );
    expect(rotated.ok, rotated.ok ? "" : rotated.error.message).toBe(true);
    await merchants().create(rotated.ok ? rotated.value : merchant);

    fixture.restart();

    const after = merchants();
    // Inside the grace: the two answer.
    expect((await after.findByIngestKey(fingerprintOf("vieja"), later(1)))?.merchantId).toBe("m_cinco");
    expect((await after.findByIngestKey(fingerprintOf("nueva"), later(1)))?.merchantId).toBe("m_cinco");
    // Past it: only the new one, and that is decided by the instant and not by a restart.
    expect(await after.findByIngestKey(fingerprintOf("vieja"), later(hours(2)))).toBeUndefined();
    expect((await after.findByIngestKey(fingerprintOf("nueva"), later(hours(2))))?.merchantId).toBe(
      "m_cinco",
    );
  });

  it("shows a merchant nothing of another one, and lists oldest first", async () => {
    const first = testMerchant({ merchantId: "m_seis", origins: ["https://seis.example"], createdAt: NOW });
    const second = testMerchant({
      merchantId: "m_siete",
      origins: ["https://siete.example"],
      ingestKeys: ["key-7"],
      createdAt: later(hours(1)),
    });
    await merchants().create(first);
    await merchants().create(second);

    fixture.restart();

    const after = merchants();
    expect((await after.list({ limit: 10 })).items.map((m) => m.merchantId)).toEqual(["m_seis", "m_siete"]);
    expect(await after.findByIngestKey(fingerprintOf("key-7"), NOW)).toBeDefined();
    expect(await after.ownerOfOrigin("https://siete.example")).toBe("m_siete");
    // Neither knows anything of the other's origin.
    expect((await after.get(asMerchantId("m_seis")))?.allowsOrigin("https://siete.example")).toBe(false);
  });

  it("releases the claims of the version it replaced, and re-claims the ones that stayed", async () => {
    // **The only place where releasing the claims is observable, and it was the gap in this suite**: a
    // create has nothing to release, so every assertion above passes against a gateway that never
    // releases anything. What that gateway breaks is not exotic — it is **every** update: re-claiming an
    // origin the merchant already had collides with its own old row, so deactivating a merchant, rotating
    // its credential or flipping its kill switch would all come back `store-unavailable`.
    await merchants().create(
      testMerchant({ merchantId: "m_nueve", origins: ["https://queda.example", "https://se-va.example"] }),
    );

    fixture.restart();

    // The port takes a merchant and not a transition, so this is the update that keeps one origin and
    // drops the other; the claims of the row have to end up mirroring whatever arrives.
    const updated = testMerchant({ merchantId: "m_nueve", origins: ["https://queda.example"] });
    expect(await merchants().update(updated)).toEqual({ ok: true, value: undefined });

    fixture.restart();

    const after = merchants();
    expect(await after.ownerOfOrigin("https://queda.example")).toBe("m_nueve");
    expect(await after.ownerOfOrigin("https://se-va.example")).toBeUndefined();
    // And the origin it gave up is free **in the table**, which is the half no read of the index can
    // answer: the only thing that refuses a claim is the unique index, so another merchant taking it is
    // the proof that the row is gone.
    const other = testMerchant({
      merchantId: "m_diez",
      origins: ["https://se-va.example"],
      ingestKeys: ["key-10"],
    });
    expect(await after.create(other)).toEqual({ ok: true, value: undefined });
  });

  // Feature 041 (ADR-045): the identity travels inside the document — no column, no migration.
  it("keeps the identity of a merchant across a restart, as a class, and a document without one still rehydrates", async () => {
    const profile = MerchantProfile.of({
      displayName: "Tienda Once",
      storeUrl: "https://once.example/tienda",
      contact: { name: "Ana", email: "ana@once.example", phone: "+54 11 5555", role: "owner" },
      notes: "Pilot.",
    });
    if (!profile.ok) throw new Error(profile.error.message);
    const named = testMerchant({
      merchantId: "m_once",
      origins: ["https://once.example"],
      ingestKeys: ["key-11"],
    }).withProfile(profile.value);
    await merchants().create(named);
    // A merchant written before ADR-045: its document has no `profile` at all.
    const old = testMerchant({
      merchantId: "m_doce",
      origins: ["https://doce.example"],
      ingestKeys: ["key-12"],
    });
    await merchants().create(old);

    fixture.restart();

    const after = merchants();
    const found = await after.get(asMerchantId("m_once"));
    expect(found?.profile).toBeInstanceOf(MerchantProfile);
    expect(found?.profile?.record()).toEqual(profile.value.record());
    expect(found?.allowsOrigin("https://once.example")).toBe(true);
    const plain = await after.get(asMerchantId("m_doce"));
    expect(plain?.profile).toBeUndefined();
    expect((await after.findByIngestKey(fingerprintOf("key-12"), NOW))?.merchantId).toBe("m_doce");
    // And replacing it after the restart is written, not only indexed.
    const renamed = MerchantProfile.of({ displayName: "Doce" });
    if (!renamed.ok) throw new Error(renamed.error.message);
    if (plain === undefined) throw new Error("m_doce is missing");
    await after.update(plain.withProfile(renamed.value));
    fixture.restart();
    expect((await merchants().get(asMerchantId("m_doce")))?.profile?.displayName).toBe("Doce");
  });

  it("keeps the revision across a restart, so the witness a reader got is the one a writer is judged by (feature 043)", async () => {
    const created = testMerchant({
      merchantId: "m_trece",
      origins: ["https://trece.example"],
      ingestKeys: ["key-13"],
    });
    await merchants().create(created);
    const off = created.switched(false);
    if (!off.ok) throw new Error(off.error.message);
    await merchants().update(off.value.deactivated());
    // A merchant written before the revision existed reads 0 until its first change.
    const old = testMerchant({
      merchantId: "m_catorce",
      origins: ["https://catorce.example"],
      ingestKeys: ["key-14"],
    }).record();
    await merchants().create(Merchant.rehydrate({ ...old, revision: undefined }));

    fixture.restart();

    const after = merchants();
    expect((await after.get(asMerchantId("m_trece")))?.witness()).toBe("m_trece:3");
    expect((await after.get(asMerchantId("m_catorce")))?.revision).toBe(0);
  });

  it("degrades instead of throwing when the store cannot accept a write", async () => {
    // The gateway is built **before** the store goes away, because filling the index is what it does when
    // it is built: against a store it cannot read it throws, and at boot that is the right answer — a
    // server that cannot read its merchants must not start. What degrades is a write, afterwards.
    const store = merchants();
    fixture.makeUnavailable();

    const refused = await store.create(testMerchant({ merchantId: "m_ocho" }));
    expect(refused.ok).toBe(false);
    expect(refused.ok ? undefined : refused.error.code).toBe("store-unavailable");
    // And the cause is in the log, because the failure channel says "nothing was written" and that is
    // not enough to diagnose a full disk from a lost permission.
    expect(fixture.logged.some((entry) => entry.message.includes("store"))).toBe(true);
  });
});
