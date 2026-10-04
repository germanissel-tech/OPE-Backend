// Feature 038 (FR-001, FR-003, FR-006, FR-009, FR-014): a merchant's text is published by an operator
// over that merchant; removing it is a version that sends the key back to the base; removing what is not
// there repeats; and what it reaches is that merchant's experiment and nobody else's.
import { describe, expect, it } from "vitest";
import {
  PublishMerchantTextUseCase,
  TextPublications,
  type ReachedByTextService,
} from "../../../../src/application/messages/index.js";
import { EVERY_MERCHANT, Operator, asOperatorId } from "../../../../src/domain/operator/index.js";
import { asMerchantId, ok } from "../../../../src/domain/shared-kernel/index.js";
import { memoryTextStore } from "../../../../src/interface-adapters/messages/index.js";
import { testExperiment } from "../../../helpers/experiments.js";
import { testMerchant } from "../../../helpers/merchants.js";
import type { ScopedMerchantService } from "../../../../src/application/merchant/index.js";
import type { Experiment } from "../../../../src/domain/experiment/index.js";
import type { TextVersion } from "../../../../src/domain/messages/index.js";

const AT = new Date("2026-10-04T12:00:00.000Z");
const clock = { now: () => AT };
const KEY = { family: "fit.policies.reassurance", locale: "es" };
const UNO = asMerchantId("m_uno");

const operator = (scope: typeof EVERY_MERCHANT | readonly string[]): Operator => {
  const built = Operator.of({
    operatorId: asOperatorId("ops"),
    tokenFingerprints: ["fp"],
    scope: scope === EVERY_MERCHANT ? EVERY_MERCHANT : scope.map(asMerchantId),
  });
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
};

/** A scope that admits the merchant when the operator covers it, and refuses otherwise. */
const scoped: ScopedMerchantService = {
  find: (actor, merchantId) => {
    const inScope = actor.scopeFor(merchantId);
    return Promise.resolve(inScope.ok ? ok(testMerchant({ merchantId: String(merchantId) })) : inScope);
  },
};

function reaching(reached: readonly Experiment[]) {
  const asked: { layer: string | undefined }[] = [];
  const restarted: { experiments: readonly Experiment[]; version: TextVersion }[] = [];
  const service: ReachedByTextService = {
    by: (layer) => {
      asked.push({ layer });
      return Promise.resolve(reached);
    },
    restart: (experiments, version) => {
      restarted.push({ experiments, version });
      return Promise.resolve(ok(undefined));
    },
  };
  return { service, asked, restarted };
}

const subject = (reached: readonly Experiment[] = []) => {
  const texts = memoryTextStore();
  const reach = reaching(reached);
  return {
    texts,
    useCase: new PublishMerchantTextUseCase({
      scoped,
      texts,
      publications: new TextPublications({ texts, reached: reach.service }),
      clock,
    }),
    ...reach,
  };
};

const request = (
  over: Partial<{ text: string | undefined; corrective: boolean; reason: string; actor: Operator }> = {},
) => ({
  actor: operator([String(UNO)]),
  merchantId: UNO,
  key: KEY,
  text: "Own text.",
  corrective: false,
  ...over,
});

describe("PublishMerchantTextUseCase", () => {
  it("publishes the merchant's text as version 1 of the key in its layer, asking what it reaches of that merchant", async () => {
    const { useCase, texts, asked } = subject();
    const done = await useCase.execute(request());
    expect(done.ok && done.value.outcome).toBe("created");
    expect(done.ok && done.value.version.messageVersionId()).toBe(`m_uno/${KEY.family}/-/es#1`);
    expect((await texts.find(UNO, KEY))?.value).toBe("Own text.");
    expect(asked).toEqual([{ layer: UNO }]);
  });

  it("refuses an operator whose scope does not cover the merchant", async () => {
    const { useCase } = subject();
    const done = await useCase.execute(request({ actor: operator(["m_dos"]) }));
    expect(done.ok ? undefined : done.error.code).toBe("merchant-out-of-scope");
  });

  it("removes the merchant's text as a version, after which the key resolves to the base", async () => {
    const { useCase, texts } = subject();
    await texts.publish({
      key: KEY,
      text: "Base.",
      corrective: false,
      publishedAt: AT,
      operatorId: asOperatorId("ops"),
    });
    await useCase.execute(request());
    const removed = await useCase.execute(request({ text: undefined }));
    expect(removed.ok && removed.value.outcome).toBe("created");
    expect(removed.ok && removed.value.version.isRemoved()).toBe(true);
    expect(removed.ok && removed.value.version.version).toBe(2);
    expect((await texts.find(UNO, KEY))?.value).toBe("Base.");
  });

  it("removing what was never published finds nothing to repeat, and removing what is already removed repeats", async () => {
    const { useCase, texts } = subject();
    const never = await useCase.execute(request({ text: undefined }));
    expect(never.ok ? undefined : never.error.code).toBe("text-version-not-found");
    expect(never.ok ? undefined : never.error.message).toBe(
      "The merchant has no text of its own for the key.",
    );
    expect(await texts.inForce(UNO, KEY)).toBeUndefined();
    await useCase.execute(request());
    await useCase.execute(request({ text: undefined }));
    const again = await useCase.execute(request({ text: undefined }));
    expect(again.ok && again.value.outcome).toBe("repeated");
    expect(again.ok && again.value.version.version).toBe(2);
  });

  it("with the merchant's experiment active and no reason it is frozen; with a reason it restarts it", async () => {
    const own = testExperiment({ merchantId: "m_uno" });
    const { useCase, restarted } = subject([own]);
    const frozen = await useCase.execute(request());
    expect(frozen.ok ? undefined : frozen.error.code).toBe("configuration-frozen");
    const done = await useCase.execute(request({ corrective: true, reason: "the shop's wording" }));
    expect(done.ok && done.value.windowsRestarted).toEqual([own]);
    expect(restarted[0]?.version.merchantId).toBe(UNO);
  });

  it("refuses an invalid key or text before anything is written", async () => {
    const { useCase, texts } = subject();
    const stray = await useCase.execute({ ...request(), key: { family: "fit.policies.typo", locale: "es" } });
    expect(stray.ok ? undefined : stray.error.code).toBe("text-key-unknown");
    const blank = await useCase.execute(request({ text: " " }));
    expect(blank.ok ? undefined : blank.error.code).toBe("corpus-text-empty");
    expect(await texts.isEmpty()).toBe(true);
  });
});
