// The in-memory level store (feature 036): the same port as the durable one, over a map.
//
// **The history reads had no cover at all**, and the mutation gate said so: `versionsOf` and `versionOf`
// are the two the API of US4 serves, and nothing reached them. The durable twin is covered by
// `tests/durability/level-store.test.ts`; this is the deployment every integration test runs on, so the two
// have to answer the same questions — a number per level, newest first, and nothing for a number nobody
// published.
import { describe, expect, it } from "vitest";
import { asOperatorId } from "../../../../src/domain/operator/index.js";
import { memoryLevelStore } from "../../../../src/interface-adapters/configuration/index.js";
import type { LevelStore } from "../../../../src/application/configuration/index.js";
import type { LevelDraft } from "../../../../src/domain/configuration/index.js";
import type { ReleaseLevel } from "../../../../src/domain/shared-kernel/index.js";

const AT = new Date("2026-10-01T12:00:00.000Z");

const draftOf = (level: ReleaseLevel, content: Record<string, unknown>): LevelDraft => ({
  level,
  content,
  corrective: false,
  publishedAt: AT,
  operatorId: asOperatorId("ops-all"),
});

/** A store holding `count` versions of `level`, each one naming its own number in its content. */
async function holding(level: ReleaseLevel, count: number): Promise<LevelStore> {
  const store = memoryLevelStore();
  for (let n = 1; n <= count; n += 1) await store.publish(draftOf(level, { nth: n }));
  return store;
}

describe("memoryLevelStore", () => {
  it("numbers each level from one and keeps the lists apart", async () => {
    const store = memoryLevelStore();
    await store.publish(draftOf("defaults", { nth: 1 }));
    const second = await store.publish(draftOf("defaults", { nth: 2 }));
    const platform = await store.publish(draftOf("platform", { nth: 1 }));

    expect(second.ok ? second.value.version : second.error).toBe(2);
    expect(platform.ok ? platform.value.version : platform.error).toBe(1);
    expect((await store.latestOf("platform"))?.content).toEqual({ nth: 1 });
    // A level nobody published holds nothing, which is what makes the boot import the seed.
    expect(await memoryLevelStore().latestOf("defaults")).toBeUndefined();
  });

  it("lists the versions of a level newest first", async () => {
    const store = await holding("defaults", 3);

    const page = await store.versionsOf("defaults", { limit: 10 });

    expect(page.items.map((v) => v.version)).toEqual([3, 2, 1]);
    // Newest first is the order a panel shows and the one the cursor pages through; oldest first would
    // make the first page the least interesting one and the cursor move whenever something is published.
    expect(page.items[0]?.content).toEqual({ nth: 3 });
  });

  it("pages the list and says where to resume, and shows nothing of the other level", async () => {
    const store = await holding("defaults", 3);
    await store.publish(draftOf("platform", { nth: 1 }));

    const first = await store.versionsOf("defaults", { limit: 2 });
    expect(first.items.map((v) => v.version)).toEqual([3, 2]);
    expect(first.nextCursor).toBeDefined();

    const next = await store.versionsOf("defaults", { limit: 2, cursor: first.nextCursor });
    expect(next.items.map((v) => v.version)).toEqual([1]);
    expect(next.nextCursor).toBeUndefined();
    expect((await store.versionsOf("platform", { limit: 10 })).items.map((v) => v.version)).toEqual([1]);
  });

  it("reads one version by its number, and nothing for a number nobody published", async () => {
    const store = await holding("defaults", 2);

    expect((await store.versionOf("defaults", 1))?.content).toEqual({ nth: 1 });
    expect((await store.versionOf("defaults", 2))?.content).toEqual({ nth: 2 });
    expect(await store.versionOf("defaults", 3)).toBeUndefined();
    // The number belongs to its level: the defaults' version 2 is not the platform's.
    expect(await store.versionOf("platform", 2)).toBeUndefined();
  });
});
