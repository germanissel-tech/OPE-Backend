// Feature 038 (FR-001 to FR-005, FR-013, FR-015): a base text is published by an operator over every
// merchant; an identical text repeats; an invalid key or text is refused before anything is written;
// with experiments reached and no reason it is frozen; with a reason it publishes and restarts.
import { describe, expect, it } from "vitest";
import {
  PublishTextUseCase,
  TextPublications,
  type ReachedByTextService,
  type TextStore,
} from "../../../../src/application/messages/index.js";
import { EVERY_MERCHANT, Operator, asOperatorId } from "../../../../src/domain/operator/index.js";
import { StoreUnavailable, asMerchantId, fail, ok } from "../../../../src/domain/shared-kernel/index.js";
import { memoryTextStore } from "../../../../src/interface-adapters/messages/index.js";
import { testExperiment } from "../../../helpers/experiments.js";
import type { Experiment } from "../../../../src/domain/experiment/index.js";
import type { TextVersion } from "../../../../src/domain/messages/index.js";

const AT = new Date("2026-10-04T12:00:00.000Z");
const clock = { now: () => AT };
const KEY = { family: "fit.policies.reassurance", locale: "es" };

const operator = (scope: typeof EVERY_MERCHANT | readonly string[]): Operator => {
  const built = Operator.of({
    operatorId: asOperatorId(scope === EVERY_MERCHANT ? "ops-all" : "ops-a"),
    tokenFingerprints: ["fp"],
    scope: scope === EVERY_MERCHANT ? EVERY_MERCHANT : scope.map(asMerchantId),
  });
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
};

/** A reach that answers what the test says, and remembers what it was asked to restart. */
function reaching(reached: readonly Experiment[]) {
  const restarted: { experiments: readonly Experiment[]; version: TextVersion }[] = [];
  const service: ReachedByTextService = {
    by: () => Promise.resolve(reached),
    restart: (experiments, version) => {
      restarted.push({ experiments, version });
      return Promise.resolve(ok(undefined));
    },
  };
  return { service, restarted };
}

const subject = (texts: TextStore, reached: readonly Experiment[] = []) => {
  const reach = reaching(reached);
  return {
    useCase: new PublishTextUseCase({
      publications: new TextPublications({ texts, reached: reach.service }),
      clock,
    }),
    restarted: reach.restarted,
  };
};

const request = (
  over: Partial<{ text: string; corrective: boolean; reason: string; actor: Operator }> = {},
) => ({
  actor: operator(EVERY_MERCHANT),
  key: KEY,
  text: "Base.",
  corrective: false,
  ...over,
});

describe("PublishTextUseCase", () => {
  it("publishes version 1 of a key as the operator over every merchant", async () => {
    const { useCase } = subject(memoryTextStore());
    const done = await useCase.execute(request());
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.value.outcome).toBe("created");
    expect(done.value.version.version).toBe(1);
    expect(done.value.version.messageVersionId()).toBe(`base/${KEY.family}/-/es#1`);
    expect(done.value.windowsRestarted).toEqual([]);
  });

  it("refuses an operator scoped to a list: a base text reaches every merchant", async () => {
    const { useCase } = subject(memoryTextStore());
    const done = await useCase.execute(request({ actor: operator(["m_a"]) }));
    expect(done.ok ? undefined : done.error.code).toBe("operator-scope-too-narrow");
  });

  it("refuses a key outside the vocabulary and an invalid text, before anything is written", async () => {
    const texts = memoryTextStore();
    const { useCase } = subject(texts);
    const stray = await useCase.execute({ ...request(), key: { family: "fit.policies.typo", locale: "es" } });
    expect(stray.ok ? undefined : stray.error.code).toBe("text-key-unknown");
    const blank = await useCase.execute(request({ text: "   " }));
    expect(blank.ok ? undefined : blank.error.code).toBe("corpus-text-empty");
    const template = await useCase.execute(request({ text: "Size {size} may vary." }));
    expect(template.ok ? undefined : template.error.code).toBe("corpus-text-has-placeholder");
    const long = await useCase.execute(request({ text: "x".repeat(513) }));
    expect(long.ok ? undefined : long.error.code).toBe("corpus-text-too-long");
    expect(await texts.isEmpty()).toBe(true);
  });

  it("repeats an identical text instead of creating a version, and restarts nothing the second time", async () => {
    const { useCase, restarted } = subject(memoryTextStore(), [testExperiment({ merchantId: "m_a" })]);
    const first = await useCase.execute(request({ corrective: true, reason: "r" }));
    expect(first.ok && first.value.outcome).toBe("created");
    const again = await useCase.execute(request({ text: " Base. ", corrective: true, reason: "r" }));
    expect(again.ok && again.value.outcome).toBe("repeated");
    expect(again.ok && again.value.version.version).toBe(1);
    expect(restarted).toHaveLength(1);
  });

  it("with experiments reached and no reason, it is frozen; with a reason, it publishes and restarts", async () => {
    const reached = [testExperiment({ merchantId: "m_a" }), testExperiment({ merchantId: "m_b" })];
    const { useCase, restarted } = subject(memoryTextStore(), reached);
    const frozen = await useCase.execute(request({ text: "Changed." }));
    expect(frozen.ok ? undefined : frozen.error.code).toBe("configuration-frozen");
    const corrective = await useCase.execute(
      request({ text: "Changed.", corrective: true, reason: "a typo" }),
    );
    expect(corrective.ok && corrective.value.windowsRestarted).toEqual(reached);
    expect(restarted[0]?.version.reason).toBe("a typo");
  });

  it("a corrective publication without a reason is refused before the freeze is even asked", async () => {
    const { useCase } = subject(memoryTextStore(), [testExperiment({ merchantId: "m_a" })]);
    const done = await useCase.execute(request({ corrective: true }));
    expect(done.ok ? undefined : done.error.code).toBe("configuration-reason-required");
  });

  it("with nothing reached, no reason is needed and nothing restarts", async () => {
    const { useCase, restarted } = subject(memoryTextStore(), []);
    const done = await useCase.execute(request());
    expect(done.ok).toBe(true);
    expect(restarted[0]?.experiments).toEqual([]);
  });

  it("a store that refuses is the failure of the port, and nothing restarts", async () => {
    const refusing: TextStore = {
      ...memoryTextStore(),
      publish: () => Promise.resolve(fail(new StoreUnavailable())),
    };
    const { useCase, restarted } = subject(refusing, [testExperiment({ merchantId: "m_a" })]);
    const done = await useCase.execute(request({ corrective: true, reason: "r" }));
    expect(done.ok ? undefined : done.error.code).toBe("store-unavailable");
    expect(restarted).toHaveLength(0);
  });
});
