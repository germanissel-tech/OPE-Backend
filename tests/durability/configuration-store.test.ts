// The published configuration across a restart (feature 033, US2). What the `fast` suite proves is that
// publishing numbers, judges and freezes; what only shows up here is that the **history** survives — the
// versions with their author, their instant and their reason, which is what makes what is in force
// auditable instead of merely current.
//
// **And the case that decides the design is the number of the next version.** In memory the number is the
// size of a list; on a store it has to come from the table, in the same step that writes (`01 §6`). A
// gateway that kept a counter of its own would number the first version of the second boot as 1 and
// overwrite the history of the first — which is the one failure this suite exists to catch, and the one
// no test that never restarts can see.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { asOperatorId } from "../../src/domain/operator/index.js";
import { asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { sqliteConfigurationStore } from "../../src/interface-adapters/configuration/index.js";
import { restartableStore, type Restartable } from "./store-fixture.js";
import type { ConfigurationStore } from "../../src/application/configuration/index.js";
import type { ConfigurationDraft } from "../../src/domain/configuration/index.js";

const NOW = new Date("2026-09-29T10:00:00.000Z");
const later = (ms: number): Date => new Date(NOW.getTime() + ms);
const OPERATOR = asOperatorId("op_ana");

let fixture: Restartable;

beforeEach(() => {
  fixture = restartableStore();
});

afterEach(() => {
  fixture.dispose();
});

/** A store over the current connection. After `restart()` this is a different one over the same file. */
const configurations = (): ConfigurationStore =>
  sqliteConfigurationStore({ store: fixture.store, logger: fixture.logger });

const draftOf = (merchantId: string, over: Partial<ConfigurationDraft> = {}): ConfigurationDraft => ({
  merchantId: asMerchantId(merchantId),
  declared: { holdoutShare: 0.1 },
  corrective: false,
  publishedAt: NOW,
  operatorId: OPERATOR,
  ...over,
});

describe("the published configuration across a restart", () => {
  it("numbers the next version over what the store holds, not over what this process published", async () => {
    // The assertion of the suite. A counter in the gateway passes every test that does not restart.
    expect((await configurations().publish(draftOf("m_uno"))).ok).toBe(true);

    fixture.restart();

    const second = await configurations().publish(draftOf("m_uno", { publishedAt: later(1000) }));
    expect(second.ok ? second.value.version : second.error).toBe(2);
  });

  it("keeps every version with its author, its instant and its reason, newest first", async () => {
    const store = configurations();
    await store.publish(draftOf("m_dos"));
    await store.publish(
      draftOf("m_dos", {
        declared: { holdoutShare: 0.2 },
        corrective: true,
        reason: "the split was wrong",
        publishedAt: later(60_000),
        operatorId: asOperatorId("op_beto"),
      }),
    );

    fixture.restart();

    const page = await configurations().versionsOf(asMerchantId("m_dos"), { limit: 10 });
    expect(page.items.map((v) => v.version)).toEqual([2, 1]);
    const [corrective, first] = page.items;
    expect(corrective?.corrective).toBe(true);
    expect(corrective?.reason).toBe("the split was wrong");
    expect(corrective?.operatorId).toBe("op_beto");
    // The instant is the one the operator published at, not the one the row was written at, and it
    // comes back a `Date`: a string here would compare equal in a log and break every arithmetic.
    expect(corrective?.publishedAt).toEqual(later(60_000));
    expect(corrective?.declared).toEqual({ holdoutShare: 0.2 });
    // A version with no reason keeps having none: the absent field must not come back as an empty
    // string, because `sameContentAs` compares it and an identical draft would stop repeating.
    expect(first?.reason).toBeUndefined();
  });

  it("serves the highest version as the one in force, with no flag that could disagree", async () => {
    const store = configurations();
    await store.publish(draftOf("m_tres"));
    await store.publish(draftOf("m_tres", { declared: { holdoutShare: 0.3 }, publishedAt: later(1000) }));

    fixture.restart();

    const latest = await configurations().latestOf(asMerchantId("m_tres"));
    expect(latest?.version).toBe(2);
    expect(latest?.declared).toEqual({ holdoutShare: 0.3 });
    // A merchant that never published has no version in force, which is what makes the seed import one.
    expect(await configurations().latestOf(asMerchantId("m_nadie"))).toBeUndefined();
  });

  it("shows a merchant nothing of another one, and numbers each from one", async () => {
    const store = configurations();
    await store.publish(draftOf("m_cuatro"));
    await store.publish(draftOf("m_cuatro", { publishedAt: later(1000) }));
    const other = await store.publish(draftOf("m_cinco"));
    expect(other.ok ? other.value.version : other.error).toBe(1);

    fixture.restart();

    const after = configurations();
    expect((await after.versionsOf(asMerchantId("m_cinco"), { limit: 10 })).items.map((v) => v.version)) //
      .toEqual([1]);
    expect((await after.latestOf(asMerchantId("m_cuatro")))?.version).toBe(2);
  });

  it("reads one version by its number from the store, and never another merchant's of the same number (feature 042)", async () => {
    const store = configurations();
    await store.publish(draftOf("m_uno", { declared: { holdoutShare: 0.1 } }));
    await store.publish(draftOf("m_uno", { declared: { holdoutShare: 0.2 }, publishedAt: later(1000) }));
    await store.publish(draftOf("m_dos", { declared: { holdoutShare: 0.3 } }));

    fixture.restart();

    const reopened = configurations();
    expect((await reopened.versionOf(asMerchantId("m_uno"), 2))?.declared).toEqual({ holdoutShare: 0.2 });
    expect((await reopened.versionOf(asMerchantId("m_dos"), 1))?.declared).toEqual({ holdoutShare: 0.3 });
    expect(await reopened.versionOf(asMerchantId("m_dos"), 2)).toBeUndefined();
    expect(await reopened.versionOf(asMerchantId("m_tres"), 1)).toBeUndefined();
  });

  it("pages the history by version, and the cursor survives what is published after it", async () => {
    // The cursor is a version and not a position, so publishing between two pages does not shift the
    // second one: what the reader asked for was "older than 2", which stays true.
    const store = configurations();
    for (let n = 0; n < 3; n += 1) await store.publish(draftOf("m_seis", { publishedAt: later(n * 1000) }));

    fixture.restart();

    const after = configurations();
    const first = await after.versionsOf(asMerchantId("m_seis"), { limit: 2 });
    expect(first.items.map((v) => v.version)).toEqual([3, 2]);
    expect(first.nextCursor).toBeDefined();

    await after.publish(draftOf("m_seis", { publishedAt: later(9000) }));

    const next = await after.versionsOf(asMerchantId("m_seis"), { limit: 2, cursor: first.nextCursor });
    expect(next.items.map((v) => v.version)).toEqual([1]);
    expect(next.nextCursor).toBeUndefined();
  });

  it("degrades instead of throwing when the store cannot accept the version", async () => {
    const store = configurations();
    fixture.makeUnavailable();

    const refused = await store.publish(draftOf("m_siete"));
    expect(refused.ok).toBe(false);
    expect(refused.ok ? undefined : refused.error.code).toBe("store-unavailable");
    // The cause is in the log, because "nothing was written" is what the operator needs and not enough
    // to tell a full disk from a lost permission.
    expect(fixture.logged.some((entry) => entry.message.includes("store"))).toBe(true);
  });
});
