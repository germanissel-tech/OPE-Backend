// The published versions of levels 1 and 2 across a restart (feature 036, T010).
//
// **This suite is the only cover the durable level store has** (feature 030, research R-06), and it exists
// because the gate found it missing: the task that asked for it was marked done without it, and the
// consequence was visible in the mutation report — the object that binds the level of `MAX(version) + 1`
// could be emptied and nothing failed, and the two read operations had no coverage at all.
//
// What only shows up by shutting down and starting again:
//
// - **The number of the next version comes from the table**, per level. A counter in the gateway numbers the
//   first version of the second boot as 1 and overwrites a history meant to be immutable — the same failure
//   `configuration-store.test.ts` watches one level down, and the reason that number is read and written in
//   one transaction (`01 §6`).
// - **The two levels are numbered apart.** They share a table, so a query that forgot its `level` would mix
//   them: the platform level would inherit the count of the defaults, and a decision would quote a
//   `platform-4` that nobody published.
// - **A version comes back as it was published**, instants included: `publishedAt` is compared and
//   subtracted, and a string does both wrong.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LevelVersion, type LevelDraft } from "../../src/domain/configuration/index.js";
import { asOperatorId } from "../../src/domain/operator/index.js";
import { sqliteLevelStore } from "../../src/interface-adapters/configuration/index.js";
import { restartableStore, type Restartable } from "./store-fixture.js";
import type { LevelStore } from "../../src/application/configuration/index.js";
import type { ReleaseLevel } from "../../src/domain/shared-kernel/index.js";

const NOW = new Date("2026-10-01T10:00:00.000Z");
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
const levels = (): LevelStore => sqliteLevelStore({ store: fixture.store, logger: fixture.logger });

const draftOf = (level: ReleaseLevel, over: Partial<LevelDraft> = {}): LevelDraft => ({
  level,
  content: { holdoutShare: 0.1 },
  corrective: false,
  publishedAt: NOW,
  operatorId: OPERATOR,
  ...over,
});

describe("the published levels across a restart", () => {
  it("numbers the next version over what the store holds, not over what this process published", async () => {
    expect((await levels().publish(draftOf("defaults"))).ok).toBe(true);

    fixture.restart();

    const second = await levels().publish(draftOf("defaults", { publishedAt: later(1000) }));
    expect(second.ok ? second.value.version : second.error).toBe(2);
    // And the name it travels under is minted from that number, so it cannot disagree with it.
    expect(second.ok ? second.value.versionName() : undefined).toBe("defaults-2");
  });

  it("numbers each level apart, although both live in one table", async () => {
    // The two levels share the table and the level is part of the key. A read that dropped it would hand
    // the platform level the count of the defaults, and every decision would stamp a version nobody
    // published.
    const store = levels();
    await store.publish(draftOf("defaults"));
    await store.publish(draftOf("defaults", { publishedAt: later(1000) }));
    const platform = await store.publish(draftOf("platform", { content: { retryAfterSeconds: 5 } }));
    expect(platform.ok ? platform.value.version : platform.error).toBe(1);

    fixture.restart();

    const after = levels();
    expect((await after.latestOf("defaults"))?.version).toBe(2);
    expect((await after.latestOf("platform"))?.version).toBe(1);
    // And what each holds is its own: the platform level never answers with the content of the defaults.
    expect((await after.latestOf("platform"))?.content).toEqual({ retryAfterSeconds: 5 });
  });

  it("keeps every version with its author, its instant and its reason, newest first", async () => {
    const store = levels();
    await store.publish(draftOf("defaults"));
    await store.publish(
      draftOf("defaults", {
        content: { holdoutShare: 0.2 },
        corrective: true,
        reason: "the holdout was wrong",
        publishedAt: later(60_000),
        operatorId: asOperatorId("op_beto"),
      }),
    );

    fixture.restart();

    const page = await levels().versionsOf("defaults", { limit: 10 });
    expect(page.items.map((v) => v.version)).toEqual([2, 1]);
    const [corrective, first] = page.items;
    expect(corrective?.corrective).toBe(true);
    expect(corrective?.reason).toBe("the holdout was wrong");
    expect(corrective?.operatorId).toBe("op_beto");
    expect(corrective?.publishedAt).toEqual(later(60_000));
    expect(corrective?.content).toEqual({ holdoutShare: 0.2 });
    // A version with no reason keeps having none: an empty string here would stop `sameContentAs` from
    // repeating an identical draft, and every publication would create a version.
    expect(first?.reason).toBeUndefined();
  });

  it("serves the highest version as the one in force, with no flag that could disagree", async () => {
    const store = levels();
    await store.publish(draftOf("platform", { content: { retryAfterSeconds: 5 } }));
    await store.publish(draftOf("platform", { content: { retryAfterSeconds: 9 }, publishedAt: later(1000) }));

    fixture.restart();

    const latest = await levels().latestOf("platform");
    expect(latest?.version).toBe(2);
    expect(latest?.content).toEqual({ retryAfterSeconds: 9 });
    // A level that holds nothing has no version in force, which is what makes the boot import the seed.
    expect(await levels().latestOf("defaults")).toBeUndefined();
  });

  it("reads one version by its number, and nothing for a number nobody published", async () => {
    const store = levels();
    await store.publish(draftOf("defaults", { content: { holdoutShare: 0.1 } }));
    await store.publish(draftOf("defaults", { content: { holdoutShare: 0.2 }, publishedAt: later(1000) }));

    fixture.restart();

    const after = levels();
    expect((await after.versionOf("defaults", 1))?.content).toEqual({ holdoutShare: 0.1 });
    expect((await after.versionOf("defaults", 2))?.content).toEqual({ holdoutShare: 0.2 });
    expect(await after.versionOf("defaults", 3)).toBeUndefined();
    // The number belongs to its level: the defaults' version 2 is not the platform's.
    expect(await after.versionOf("platform", 2)).toBeUndefined();
  });

  it("pages the history by version, and the cursor survives what is published after it", async () => {
    // The cursor is a version and not a position, so publishing between two pages does not shift the
    // second one: what the reader asked for was "older than 2", which stays true.
    const store = levels();
    for (let n = 0; n < 3; n += 1) {
      await store.publish(draftOf("defaults", { content: { holdoutShare: n / 10 } }));
    }

    fixture.restart();

    const after = levels();
    const first = await after.versionsOf("defaults", { limit: 2 });
    expect(first.items.map((v) => v.version)).toEqual([3, 2]);
    expect(first.nextCursor).toBeDefined();

    await after.publish(draftOf("defaults", { content: { holdoutShare: 0.9 } }));

    const next = await after.versionsOf("defaults", { limit: 2, cursor: first.nextCursor });
    expect(next.items.map((v) => v.version)).toEqual([1]);
    expect(next.nextCursor).toBeUndefined();
  });

  it("degrades instead of throwing when the store cannot accept the version", async () => {
    const store = levels();
    fixture.makeUnavailable();

    const refused = await store.publish(draftOf("defaults"));

    expect(refused.ok).toBe(false);
    expect(refused.ok ? undefined : refused.error.code).toBe("store-unavailable");
    expect(fixture.logged.some((entry) => entry.message.includes("store"))).toBe(true);
  });

  it("rehydrates a version as an entity and not as the row it was read from", async () => {
    // What comes back has to answer the questions the publication asks of it — the name minted from the
    // number and whether a draft repeats it — because the use case receives this and nothing else.
    await levels().publish(draftOf("defaults", { content: { holdoutShare: 0.1 } }));

    fixture.restart();

    const inForce = await levels().latestOf("defaults");
    expect(inForce).toBeInstanceOf(LevelVersion);
    expect(inForce?.versionName()).toBe("defaults-1");
    expect(inForce?.sameContentAs(draftOf("defaults", { content: { holdoutShare: 0.1 } }))).toBe(true);
    expect(inForce?.sameContentAs(draftOf("defaults", { content: { holdoutShare: 0.2 } }))).toBe(false);
  });
});
