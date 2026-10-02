// Publishing level 2 by API (feature 036, US1 and US2), over HTTP and end to end.
//
// **What it is really about is that the change counts without a restart.** Until this feature the treatment
// defaults travelled with the release, so changing one meant a deploy — which reaches every merchant exactly
// the same way, leaves no version, no entry in the administration log and restarts no measurement window.
// Here the same change is a numbered version, and the request right after it is served with it.
//
// The body is built from what the API itself answers, minus the version: that is what a panel does, and it
// keeps the test from carrying a copy of the whole level that would rot the day a field is added.
//
// **Which field each case changes is not decoration.** The two merchants of the seed declare `holdoutShare`
// and nothing else, so a change of that leaf reaches **neither** of them, and a change of
// `decisionPolicy.threshold` reaches **both**. That is the difference the feature is built on, and it is why
// these cases look like they are about different fields when they are about reach.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { AdminLogPort } from "../../src/composition/modules/admin.js";
import { ConfigurationServicePort } from "../../src/composition/modules/configuration.js";
import { ExperimentStorePort } from "../../src/composition/modules/experiment.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { json } from "../helpers/json.js";
import { admin, fixedClock, startTestApp } from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";

const A = asMerchantId("m_a");
const B = asMerchantId("m_b");

let app: App;

beforeEach(async () => {
  app = await startTestApp({ ports: [replace(ClockPort, fixedClock())] });
});

afterEach(async () => {
  await app.close();
});

/** What the level in force holds, without the name minted from its number: the body a panel would send. */
async function contentInForce(): Promise<Record<string, unknown>> {
  const read = json(await admin(app.app, "GET", "/v1/admin/treatment-defaults")) as Record<string, unknown>;
  const { version, ...content } = read;
  expect(version).toBe("defaults-1");
  return content;
}

/** The same content with one leaf of the decision policy changed: a leaf no merchant of the seed declares. */
function withThreshold(content: Record<string, unknown>, threshold: number): Record<string, unknown> {
  const policy = content["decisionPolicy"] as Record<string, unknown>;
  return { ...content, decisionPolicy: { ...policy, threshold } };
}

const publish = (body: unknown, as?: "ops-a") =>
  admin(app.app, "POST", "/v1/admin/treatment-defaults", { body, ...(as === undefined ? {} : { as }) });

const configuration = () => app.resolve(ConfigurationServicePort);

describe("publishing the treatment defaults (US1)", () => {
  it("numbers the version, serves it on the next request and leaves its entry in the log", async () => {
    const content = await contentInForce();
    expect((await configuration().effectiveFor(A)).values.decisionPolicy.threshold).toBe(0.6);

    // **With its reason, because the seed's experiment is already active**: `m_a` opens one from its seed and
    // does not declare this leaf, so the change reaches a running measurement and the rule of US2 applies.
    // That is the ordinary case of a platform with traffic, which is why this one is written that way.
    const response = await publish({
      content: withThreshold(content, 0.8),
      corrective: true,
      reason: "threshold raised",
    });

    expect(response.statusCode).toBe(201);
    expect(json(response)).toMatchObject({ version: 2, stampedAs: "defaults-2", corrective: true });

    // **The next request, without a restart**: a merchant that does not declare this leaf is served the new
    // value, and the triple it stamps names the version it came from.
    const effective = await configuration().effectiveFor(A);
    expect(effective.values.decisionPolicy.threshold).toBe(0.8);
    expect(effective.versions.defaults).toBe("defaults-2");

    const log = await app.resolve(AdminLogPort).list({ limit: 1 });
    expect(log.items[0]).toMatchObject({
      operation: "publishTreatmentDefaults",
      operatorId: "ops-all",
      outcome: "accepted",
      result: { configurationVersion: 2, windowRestarted: true },
    });
  });

  it("repeats the version in force when the content is identical, instead of creating another", async () => {
    const again = await publish({ content: await contentInForce() });

    expect(again.statusCode).toBe(200);
    expect(json(again)).toMatchObject({ version: 1, stampedAs: "defaults-1" });
  });

  it("refuses a value an invariant rejects, naming the field, and creates no version", async () => {
    // `0.004` is a share the schema accepts and the split cannot hand out: it rounds to no bucket at all
    // (ADR-035). The schema cannot see that; the invariant of its type can.
    const content = await contentInForce();
    const response = await publish({ content: { ...content, holdoutShare: 0.004 } });

    expect(response.statusCode).toBe(422);
    const problem = json(response) as { type: string; errors?: { pointer: string }[] };
    expect(problem.type).toBe("urn:ope:problem:invalid-configuration-value");
    expect(problem.errors?.[0]?.pointer).toContain("holdoutShare");
    expect((await configuration().defaults()).version).toBe("defaults-1");
  });

  it("refuses an operator whose scope is a list, because the change reaches every merchant", async () => {
    // `ops-a` is scoped to one merchant. A level is served to whoever does not override it, including
    // merchants that do not exist yet, so a partial scope cannot publish one.
    const response = await publish({ content: withThreshold(await contentInForce(), 0.7) }, "ops-a");

    expect(response.statusCode).toBe(403);
    expect((json(response) as { type: string }).type).toBe("urn:ope:problem:operator-scope-too-narrow");
    const log = await app.resolve(AdminLogPort).list({ limit: 1 });
    // Denied, not rejected: what failed is the authority, and the entry says which of the two it was.
    expect(log.items[0]).toMatchObject({ operation: "publishTreatmentDefaults", outcome: "denied" });
  });

  it("does not change what a merchant declares for itself", async () => {
    // Both merchants of the seed declare `holdoutShare: 0`, so moving the default does not move them: what
    // level 3 declares keeps winning, which is the whole order of the three levels.
    const content = await contentInForce();
    expect((await publish({ content: { ...content, holdoutShare: 0.2 } })).statusCode).toBe(201);

    expect((await configuration().defaults()).values.record().holdoutShare).toBe(0.2);
    expect((await configuration().effectiveFor(A)).values.holdoutShare).toBe(0);
    expect((await configuration().effectiveFor(B)).values.holdoutShare).toBe(0);
  });
});

describe("a change that reaches a running measurement (US2)", () => {
  /**
   * The seed of `m_a` opens its experiment **already active**, so this is idempotent and kept on purpose:
   * what each case depends on is that it is active, and saying so beats depending on the seed's state.
   */
  async function activate(): Promise<void> {
    const response = await admin(
      app.app,
      "POST",
      `/v1/admin/merchants/${A}/experiments/exp_a_000001/activate`,
    );
    expect(response.statusCode).toBe(200);
  }

  it("refuses a change without a reason while it reaches an active experiment", async () => {
    await activate();
    const response = await publish({ content: withThreshold(await contentInForce(), 0.9) });

    expect(response.statusCode).toBe(409);
    expect((json(response) as { type: string }).type).toBe("urn:ope:problem:configuration-frozen");
    expect((await configuration().defaults()).version).toBe("defaults-1");
  });

  it("accepts it with its reason, restarts the window of each reached experiment and records both", async () => {
    await activate();
    const before = await app.resolve(ExperimentStorePort).listOf(A, { limit: 1 });
    const startedBefore = before.items[0]?.windowStartedAt;

    const response = await publish({
      content: withThreshold(await contentInForce(), 0.9),
      corrective: true,
      reason: "threshold raised before the pilot",
    });

    expect(response.statusCode).toBe(201);
    expect(json(response)).toMatchObject({
      version: 2,
      corrective: true,
      reason: "threshold raised before the pilot",
      windowsRestarted: ["exp_a_000001"],
    });

    const after = await app.resolve(ExperimentStorePort).listOf(A, { limit: 1 });
    const restarted = after.items[0];
    expect(restarted?.windowStartedAt).not.toEqual(startedBefore);
    // **The restart says which level's version caused it**: with three levels publishing, the number alone
    // would not say whose version 2 it was.
    expect(restarted?.windowRestarts).toEqual([
      {
        at: restarted?.windowStartedAt,
        reason: "threshold raised before the pilot",
        level: "defaults",
        configurationVersion: 2,
      },
    ]);
  });

  it("does not reach an experiment of a merchant that declares every leaf that changed", async () => {
    // **The case that separates reading by leaf from reading by field.** `m_a` declares `holdoutShare`, so a
    // change of only that leaf does not touch its treatment: no reason is needed and its window stands.
    await activate();
    const before = await app.resolve(ExperimentStorePort).listOf(A, { limit: 1 });

    const response = await publish({ content: { ...(await contentInForce()), holdoutShare: 0.4 } });

    expect(response.statusCode).toBe(201);
    expect(json(response)).not.toHaveProperty("windowsRestarted");
    const after = await app.resolve(ExperimentStorePort).listOf(A, { limit: 1 });
    expect(after.items[0]?.windowStartedAt).toEqual(before.items[0]?.windowStartedAt);
    expect(after.items[0]?.windowRestarts).toEqual([]);
  });
});
