// The history of each level, over HTTP (feature 036, US4; FR-014).
//
// **What it is for is explaining what is in force, not seeing it.** The version in force is one read away;
// what the history adds is the chain that leads to it — when, who, with what reason when there was one — and
// the one thing nobody else can answer: **what the treatment was while a decision stamped a given name**.
// A version is immutable, so reading version 1 tomorrow answers what it answered today.
//
// The first version of each level is the seed of the release, published by the operator `system`: that is
// what makes the history complete rather than starting at the first thing a person did.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { json, problemOf } from "../helpers/json.js";
import { admin, fixedClock, startTestApp } from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";

interface VersionDto {
  version: number;
  stampedAs: string;
  content: Record<string, unknown>;
  corrective: boolean;
  reason?: string;
  publishedAt: string;
  operatorId: string;
}
interface PageDto {
  items: VersionDto[];
  nextCursor?: string;
}

const LEVELS = {
  platform: "/v1/admin/platform-configuration",
  defaults: "/v1/admin/treatment-defaults",
} as const;

type Level = keyof typeof LEVELS;

/**
 * A value of each level that moves with `n`, and **one no publication of this suite has to explain**: the
 * `Retry-After` is operational, so it reaches no measurement, and both merchants of the seed declare their
 * own `holdoutShare`, so moving the default reaches neither of them. A field that did reach one would answer
 * `409` here and the suite would be about the freeze instead of about the history.
 */
const moveOf = (level: Level, n: number): Record<string, unknown> =>
  level === "platform" ? { retryAfterSeconds: n } : { holdoutShare: n / 10 };

let app: App;

beforeEach(async () => {
  app = await startTestApp({ ports: [replace(ClockPort, fixedClock())] });
});

afterEach(async () => {
  await app.close();
});

/** Publishes one more version of a level, with the value `moveOf` gives for `n`. */
async function publish(level: Level, n: number, reason?: string) {
  const url = LEVELS[level];
  const read = json(await admin(app.app, "GET", url)) as Record<string, unknown>;
  const { version, ...content } = read;
  expect(version).toBeDefined();
  const body = {
    content: { ...content, ...moveOf(level, n) },
    ...(reason === undefined ? {} : { corrective: true, reason }),
  };
  const response = await admin(app.app, "POST", url, { body });
  expect(response.statusCode).toBe(201);
}

const history = async (level: Level, query = ""): Promise<PageDto> =>
  json(await admin(app.app, "GET", `${LEVELS[level]}/versions${query}`)) as PageDto;

const versionOf = (level: Level, n: number) => admin(app.app, "GET", `${LEVELS[level]}/versions/${n}`);

describe.each(["platform", "defaults"] as const)("the history of the %s level", (level) => {
  it("starts at the seed of the release, published by the system operator", async () => {
    const page = await history(level);

    expect(page.items).toHaveLength(1);
    const [seed] = page.items;
    expect(seed?.version).toBe(1);
    expect(seed?.stampedAs).toBe(`${level}-1`);
    expect(seed?.operatorId).toBe("system");
    expect(seed?.corrective).toBe(false);
    expect(seed?.reason).toBeUndefined();
  });

  it("lists newest first, with the actor, the instant and the reason of each one", async () => {
    await publish(level, 2, "measured before the pilot");
    await publish(level, 3);

    const page = await history(level);

    expect(page.items.map((v) => v.version)).toEqual([3, 2, 1]);
    expect(page.items.map((v) => v.stampedAs)).toEqual([`${level}-3`, `${level}-2`, `${level}-1`]);
    const corrective = page.items[1];
    expect(corrective?.corrective).toBe(true);
    expect(corrective?.reason).toBe("measured before the pilot");
    expect(corrective?.operatorId).toBe("ops-all");
    // The instant of the publication, as an instant the panel can order by.
    expect(Date.parse(corrective?.publishedAt ?? "")).not.toBeNaN();
  });

  it("pages the history, and the two pages together are the whole of it", async () => {
    // **The cursor of this deployment is a position and the durable one is a key**, which is written down in
    // `paging.ts` and is not something this feature changed: in memory a page is a slice of a list. So what
    // this case asks is that the pages cover the history and the last one says it is the last; that the
    // cursor does **not** move when something is published between two pages is a property of the store,
    // and `tests/durability/level-store.test.ts` is where it is proven.
    for (let n = 2; n <= 3; n += 1) await publish(level, n);

    const first = await history(level, "?limit=2");
    expect(first.items.map((v) => v.version)).toEqual([3, 2]);
    expect(first.nextCursor).toBeDefined();

    const next = await history(level, `?limit=2&cursor=${encodeURIComponent(first.nextCursor ?? "")}`);
    expect(next.items.map((v) => v.version)).toEqual([1]);
    expect(next.nextCursor).toBeUndefined();
  });

  it("reads one version by its number, and answers 404 for a number nobody published", async () => {
    await publish(level, 2, "the value was wrong");

    const first = json(await versionOf(level, 1)) as VersionDto;
    expect(first.version).toBe(1);
    expect(first.stampedAs).toBe(`${level}-1`);
    const second = json(await versionOf(level, 2)) as VersionDto;
    expect(second.content).toMatchObject(moveOf(level, 2));

    const missing = await versionOf(level, 7);
    expect(missing.statusCode).toBe(404);
    expect(problemOf(missing).type).toBe("urn:ope:problem:configuration-version-not-found");
  });

  it("answers the version as it was published, not as the level is now", async () => {
    // **The reason this operation exists.** A decision stamps a name; months later the only way to know what
    // that name meant is this read, and it has to answer the old content and not the current one.
    const before = json(await versionOf(level, 1)) as VersionDto;
    await publish(level, 2, "the value was wrong");

    const again = json(await versionOf(level, 1)) as VersionDto;
    expect(again).toEqual(before);
    expect(again.content).not.toMatchObject(moveOf(level, 2));
  });

  it("takes the capability of an operator and nothing else: a scope of one merchant reads it too", async () => {
    // A level is served to every merchant, so there is no merchant to be out of scope of. Writing one takes
    // an operator over all of them; reading its history takes `configuration:read`, which `ops-a` has.
    const response = await admin(app.app, "GET", `${LEVELS[level]}/versions`, { as: "ops-a" });

    expect(response.statusCode).toBe(200);
    expect((json(response) as PageDto).items).toHaveLength(1);
  });

  it("refuses a request with no operator at all", async () => {
    const response = await admin(app.app, "GET", `${LEVELS[level]}/versions`, { as: null });

    expect(response.statusCode).toBe(401);
  });
});

describe("the two histories are separate", () => {
  it("numbers each level on its own, and one level never answers with a version of the other", async () => {
    await publish("defaults", 2, "the holdout was wrong");
    await publish("defaults", 3);

    expect((await history("defaults")).items.map((v) => v.version)).toEqual([3, 2, 1]);
    expect((await history("platform")).items.map((v) => v.version)).toEqual([1]);
    expect((await versionOf("platform", 3)).statusCode).toBe(404);
    expect(json(await versionOf("defaults", 3))).toMatchObject({ stampedAs: "defaults-3" });
  });
});
