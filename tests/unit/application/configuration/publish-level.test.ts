// Publishing a level, with doubles (feature 036, US1 and US2).
//
// **What this covers and the integration test cannot**: the order in which the use case asks. A store that
// refuses, a judge that rejects and a reach that answers — each one has to stop the publication at its own
// point, and what matters is not only the answer but **what was not done** afterwards. The integration test
// says the API behaves; this one says nothing was written when it should not have been.
import { describe, expect, it } from "vitest";
import {
  PublishLevelUseCase,
  type LevelStore,
  type ReachedExperimentsService,
  type ConfigurationService,
} from "../../../../src/application/configuration/index.js";
import {
  InvalidConfigurationValue,
  LevelVersion,
  type LevelDraft,
} from "../../../../src/domain/configuration/index.js";
import { EVERY_MERCHANT, Operator, asOperatorId } from "../../../../src/domain/operator/index.js";
import { StoreUnavailable, asMerchantId, fail, ok } from "../../../../src/domain/shared-kernel/index.js";
import { testExperiment } from "../../../helpers/experiments.js";
import type { Clock } from "../../../../src/application/shared-kernel/index.js";
import type { Experiment } from "../../../../src/domain/experiment/index.js";

const AT = new Date("2026-10-01T12:00:00.000Z");
const clock: Clock = { now: () => AT };

const operator = (scope: "*" | string[]): Operator => {
  const built = Operator.of({
    operatorId: asOperatorId("ops"),
    tokenFingerprints: ["fp"],
    scope: scope === EVERY_MERCHANT ? EVERY_MERCHANT : scope.map(asMerchantId),
  });
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
};

const THRESHOLD = { decisionPolicy: { threshold: 0.6 } };

interface Doubles {
  published: LevelDraft[];
  refreshed: () => number;
  restarted: () => readonly Experiment[][];
  use: PublishLevelUseCase;
}

/** The three collaborators, each able to answer the one thing its case is about. */
function doubles(
  over: {
    inForce?: LevelVersion;
    judge?: InvalidConfigurationValue;
    writes?: boolean;
    reached?: readonly Experiment[];
    restart?: StoreUnavailable;
    /** What the version in force restarted when it was published, for a repetition to answer. */
    repeatedRestarted?: readonly Experiment[];
  } = {},
): Doubles {
  const published: LevelDraft[] = [];
  const restarts: Experiment[][] = [];
  let refreshes = 0;
  const levels = {
    latestOf: () => Promise.resolve(over.inForce),
    publish: (draft: LevelDraft) => {
      if (over.writes === false) return Promise.resolve(fail(new StoreUnavailable()));
      published.push(draft);
      return Promise.resolve(ok(LevelVersion.numbered(draft, (over.inForce?.version ?? 0) + 1)));
    },
  } as unknown as LevelStore;
  const configuration = {
    judgeLevel: () => Promise.resolve(over.judge === undefined ? ok(undefined) : fail(over.judge)),
    refresh: () => {
      refreshes += 1;
      return Promise.resolve();
    },
  } as unknown as ConfigurationService;
  const reached: ReachedExperimentsService = {
    by: () => Promise.resolve(over.reached ?? []),
    restartedBy: (version) => Promise.resolve({ version, windowsRestarted: over.repeatedRestarted ?? [] }),
    restart: (experiments) => {
      restarts.push([...experiments]);
      return Promise.resolve(over.restart === undefined ? ok(undefined) : fail(over.restart));
    },
  };
  return {
    published,
    refreshed: () => refreshes,
    restarted: () => restarts,
    use: new PublishLevelUseCase({ levels, configuration, reached, clock }),
  };
}

const publish = (
  d: Doubles,
  over: { content?: object; corrective?: boolean; reason?: string; witness?: string } = {},
) =>
  d.use.execute({
    actor: operator(EVERY_MERCHANT),
    level: "defaults",
    // The witness of the version every double holds in force, unless the case is about another one.
    witness: over.witness ?? "defaults-1",
    content: (over.content ?? { decisionPolicy: { threshold: 0.8 } }) as Record<string, unknown>,
    corrective: over.corrective ?? false,
    ...(over.reason === undefined ? {} : { reason: over.reason }),
  });

const inForce = (content: object, version = 1): LevelVersion =>
  LevelVersion.numbered(
    {
      level: "defaults",
      content: content as Record<string, unknown>,
      corrective: false,
      publishedAt: AT,
      operatorId: asOperatorId("ops"),
    },
    version,
  );

describe("PublishLevelUseCase", () => {
  it("publishes the next version, re-reads what it serves and says nothing was restarted", async () => {
    const d = doubles({ inForce: inForce(THRESHOLD) });

    const result = await publish(d);

    expect(result.ok && result.value.outcome).toBe("created");
    expect(result.ok && result.value.version.version).toBe(2);
    expect(result.ok && result.value.windowsRestarted).toEqual([]);
    expect(d.refreshed()).toBe(1);
  });

  it("refuses an operator whose scope is a list, before asking anything", async () => {
    // **Before anything**: the authority is judged first, so a narrow operator does not even read the level
    // in force. Answering after a read would leak that there is one.
    const d = doubles({ inForce: inForce(THRESHOLD) });

    const result = await d.use.execute({
      actor: operator(["m_a"]),
      level: "defaults",
      witness: "defaults-1",
      content: THRESHOLD,
      corrective: false,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe("operator-scope-too-narrow");
    expect(d.published).toEqual([]);
    expect(d.refreshed()).toBe(0);
  });

  it("refuses a corrective version with no reason, before reading the level", async () => {
    const d = doubles({ inForce: inForce(THRESHOLD) });
    const result = await publish(d, { corrective: true });

    expect(result.ok ? undefined : result.error.code).toBe("configuration-reason-required");
    expect(d.published).toEqual([]);
  });

  it("repeats the version in force when the content is the same, without re-reading anything", async () => {
    // Nothing changed, so nothing was resolved differently: refreshing would make every merchant pay a
    // read for a publication that changed nothing.
    const d = doubles({ inForce: inForce(THRESHOLD) });

    const result = await publish(d, { content: THRESHOLD });

    expect(result.ok && result.value.outcome).toBe("repeated");
    expect(result.ok && result.value.version.version).toBe(1);
    expect(d.published).toEqual([]);
    expect(d.refreshed()).toBe(0);
  });

  it("a repetition answers what the version in force restarted when it was published (feature 042)", async () => {
    const restarted = [testExperiment({ merchantId: "m_a" })];
    const d = doubles({ inForce: inForce(THRESHOLD), repeatedRestarted: restarted });

    const result = await publish(d, { content: THRESHOLD });

    expect(result.ok && result.value.windowsRestarted).toEqual(restarted);
    expect(d.restarted()).toEqual([]);
  });

  it("a witness of a version no longer in force is refused before anything is judged or written (feature 043)", async () => {
    const d = doubles({ inForce: inForce(THRESHOLD, 2) });

    const result = await publish(d, { witness: "defaults-1" });

    expect(result.ok ? undefined : result.error.code).toBe("stale-version");
    expect(d.published).toEqual([]);
    // An identical body overwrites nothing: the retry of what went through answers as before.
    const again = await publish(d, { content: THRESHOLD, witness: "defaults-1" });
    expect(again.ok && again.value.outcome).toBe("repeated");
  });

  it("writes nothing when the content does not judge", async () => {
    const d = doubles({
      inForce: inForce(THRESHOLD),
      judge: new InvalidConfigurationValue("holdoutShare", "is too fine"),
    });

    const result = await publish(d);

    expect(result.ok ? undefined : result.error.code).toBe("invalid-configuration-value");
    expect(d.published).toEqual([]);
    expect(d.refreshed()).toBe(0);
  });

  it("refuses without a reason when the change reaches an active experiment, and writes nothing", async () => {
    const d = doubles({ inForce: inForce(THRESHOLD), reached: [testExperiment({ merchantId: "m_a" })] });

    const result = await publish(d);

    expect(result.ok ? undefined : result.error.code).toBe("configuration-frozen");
    expect(d.published).toEqual([]);
    expect(d.restarted()).toEqual([]);
  });

  it("publishes and restarts each reached window when the reason is there", async () => {
    const reached = [testExperiment({ merchantId: "m_a" }), testExperiment({ merchantId: "m_b" })];
    const d = doubles({ inForce: inForce(THRESHOLD), reached });

    const result = await publish(d, { corrective: true, reason: "threshold raised" });

    expect(result.ok && result.value.windowsRestarted).toHaveLength(2);
    expect(d.restarted()).toEqual([reached]);
    expect(d.refreshed()).toBe(1);
  });

  it("answers the failure of a store that cannot write, and re-reads nothing", async () => {
    const d = doubles({ inForce: inForce(THRESHOLD), writes: false });

    const result = await publish(d);

    expect(result.ok ? undefined : result.error.code).toBe("store-unavailable");
    expect(d.refreshed()).toBe(0);
  });

  it("answers the failure of a restart that could not be recorded", async () => {
    // The version is already published here, and that is what the response says: the failure is the restart,
    // and reporting it as success would leave a window nobody restarted and nobody knows about.
    const d = doubles({
      inForce: inForce(THRESHOLD),
      reached: [testExperiment({ merchantId: "m_a" })],
      restart: new StoreUnavailable(),
    });

    const result = await publish(d, { corrective: true, reason: "why" });

    expect(result.ok ? undefined : result.error.code).toBe("store-unavailable");
  });

  it("publishes version 1 when the level holds none, without asking who it reaches", async () => {
    // An empty level is the seed's job, and there is nothing to compare against: no leaf changed, because
    // there was no leaf. Asking for reach would be asking about a treatment nobody was served.
    const d = doubles({});

    const result = await publish(d);

    expect(result.ok && result.value.version.version).toBe(1);
    expect(d.restarted()).toEqual([[]]);
  });
});
