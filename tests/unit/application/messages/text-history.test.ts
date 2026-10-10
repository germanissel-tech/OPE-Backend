// Feature 038 (FR-016, FR-017): the history of a key in a layer — newest first, paginated, removal
// included — and one version as it was published. The base is read by any operator with the capability;
// the merchant's layer within the operator's scope over it. A key outside the vocabulary has no history.
import { describe, expect, it } from "vitest";
import {
  GetMerchantTextVersionUseCase,
  GetTextVersionUseCase,
  ListMerchantTextVersionsUseCase,
  ListTextVersionsUseCase,
  type ReachedByTextService,
} from "../../../../src/application/messages/index.js";
import { EVERY_MERCHANT, Operator, asOperatorId } from "../../../../src/domain/operator/index.js";
import { asMerchantId, ok } from "../../../../src/domain/shared-kernel/index.js";
import { memoryTextStore } from "../../../../src/interface-adapters/messages/index.js";
import { testMerchant } from "../../../helpers/merchants.js";
import type { ScopedMerchantService } from "../../../../src/application/merchant/index.js";
import type { TextDraft } from "../../../../src/domain/messages/index.js";

const AT = new Date("2026-10-04T12:00:00.000Z");
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

const scoped: ScopedMerchantService = {
  find: (actor, merchantId) => {
    const inScope = actor.scopeFor(merchantId);
    return Promise.resolve(inScope.ok ? ok(testMerchant({ merchantId: String(merchantId) })) : inScope);
  },
};

/** Nothing restarted any of these versions: the history here is about the versions themselves. */
const reached: ReachedByTextService = {
  by: () => Promise.resolve([]),
  restart: () => Promise.resolve(ok(undefined)),
  restartedBy: (version) => Promise.resolve({ version, windowsRestarted: [] }),
};

const draft = (over: Partial<TextDraft>): TextDraft => ({
  key: KEY,
  text: "A text.",
  corrective: false,
  publishedAt: AT,
  operatorId: asOperatorId("ops"),
  ...over,
});

async function given() {
  const texts = memoryTextStore();
  for (const text of ["First.", "Second.", "Third."]) await texts.publish(draft({ text }));
  await texts.publish(draft({ merchantId: UNO, text: "Own." }));
  await texts.publish(
    Object.fromEntries(Object.entries(draft({ merchantId: UNO })).filter(([f]) => f !== "text")) as TextDraft,
  );
  return texts;
}

describe("the history of a base key", () => {
  it("lists the versions newest first, paginated, and reads one by its number", async () => {
    const texts = await given();
    const list = new ListTextVersionsUseCase({ texts, reached });
    const first = await list.execute({ key: KEY, page: { limit: 2 } });
    expect(first.items.map((v) => v.version.version)).toEqual([3, 2]);
    const rest = await list.execute({ key: KEY, page: { limit: 2, cursor: first.nextCursor } });
    expect(rest.items.map((v) => v.version.version)).toEqual([1]);
    expect(rest.nextCursor).toBeUndefined();
    const read = await new GetTextVersionUseCase({ texts, reached }).execute({ key: KEY, version: 2 });
    expect(read.ok && read.value.version.text?.value).toBe("Second.");
  });

  it("a number nobody published, or a key outside the vocabulary, has no version: the list is empty and the read is not found", async () => {
    const texts = await given();
    const stray = { family: "fit.policies.typo", locale: "es" };
    expect(
      (await new ListTextVersionsUseCase({ texts, reached }).execute({ key: stray, page: { limit: 10 } }))
        .items,
    ).toEqual([]);
    const get = new GetTextVersionUseCase({ texts, reached });
    const missing = await get.execute({ key: KEY, version: 7 });
    expect(missing.ok ? undefined : missing.error.code).toBe("text-version-not-found");
    expect(missing.ok ? undefined : missing.error.message).toBe("The key has no version 7.");
    expect((await get.execute({ key: stray, version: 1 })).ok).toBe(false);
  });
});

describe("the history of a merchant's key", () => {
  it("keeps the removal as a version, and is read only within the operator's scope", async () => {
    const texts = await given();
    const list = new ListMerchantTextVersionsUseCase({ scoped, texts, reached });
    const own = await list.execute({
      actor: operator([String(UNO)]),
      merchantId: UNO,
      key: KEY,
      page: { limit: 10 },
    });
    expect(own.ok && own.value.items.map(({ version }) => [version.version, version.isRemoved()])).toEqual([
      [2, true],
      [1, false],
    ]);
    const foreign = await list.execute({
      actor: operator(["m_dos"]),
      merchantId: UNO,
      key: KEY,
      page: { limit: 10 },
    });
    expect(foreign.ok ? undefined : foreign.error.code).toBe("merchant-out-of-scope");
    const stray = await list.execute({
      actor: operator(EVERY_MERCHANT),
      merchantId: UNO,
      key: { family: "fit.policies.typo", locale: "es" },
      page: { limit: 10 },
    });
    expect(stray.ok && stray.value.items).toEqual([]);
  });

  it("reads one version by its number within the scope, and finds neither a stray number nor a stray key", async () => {
    const texts = await given();
    const get = new GetMerchantTextVersionUseCase({ scoped, texts, reached });
    const removal = await get.execute({
      actor: operator(EVERY_MERCHANT),
      merchantId: UNO,
      key: KEY,
      version: 2,
    });
    expect(removal.ok && removal.value.version.isRemoved()).toBe(true);
    const foreign = await get.execute({ actor: operator(["m_dos"]), merchantId: UNO, key: KEY, version: 1 });
    expect(foreign.ok ? undefined : foreign.error.code).toBe("merchant-out-of-scope");
    const missing = await get.execute({
      actor: operator(EVERY_MERCHANT),
      merchantId: UNO,
      key: KEY,
      version: 3,
    });
    expect(missing.ok ? undefined : missing.error.code).toBe("text-version-not-found");
    const stray = await get.execute({
      actor: operator(EVERY_MERCHANT),
      merchantId: UNO,
      key: { family: "fit.policies.typo", locale: "es" },
      version: 1,
    });
    expect(stray.ok ? undefined : stray.error.code).toBe("text-version-not-found");
  });
});
