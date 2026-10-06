// Feature 038 (FR-020): the seed of the base texts enters an empty store as version 1 of each key, judged
// complete against the languages the seeded levels support; a store that already holds texts keeps them.
import { describe, expect, it } from "vitest";
import { ImportTextsUseCase, type SeedText } from "../../../../src/application/messages/index.js";
import { TextKey } from "../../../../src/domain/messages/index.js";
import { Operator } from "../../../../src/domain/operator/index.js";
import { memoryTextStore } from "../../../../src/interface-adapters/messages/index.js";

const AT = new Date("2026-10-04T12:00:00.000Z");
const clock = { now: () => AT };
const actor = Operator.system();

/** A seed complete in `locale`: one text per unconditional family. */
const completeIn = (locale: string): SeedText[] =>
  TextKey.unconditionalFamilies().map((family) => ({ key: { family, locale }, text: `Text for ${family}.` }));

describe("ImportTextsUseCase", () => {
  it("imports a complete seed into an empty store as version 1 of each key, in the base layer", async () => {
    const texts = memoryTextStore();
    const seed = completeIn("es");
    const done = await new ImportTextsUseCase({ texts, clock }).execute({
      actor,
      texts: seed,
      locales: ["es"],
    });
    expect(done).toEqual({ ok: true, value: { imported: seed.length } });
    const first = seed[0];
    if (first === undefined) throw new Error("no seed");
    const inForce = await texts.inForce(undefined, first.key);
    expect(inForce?.version).toBe(1);
    expect(inForce?.operatorId).toBe(actor.operatorId);
    expect(inForce?.text?.value).toBe(first.text);
  });

  it("keeps a store that already holds texts, and says so", async () => {
    const texts = memoryTextStore();
    const useCase = new ImportTextsUseCase({ texts, clock });
    await useCase.execute({ actor, texts: completeIn("es"), locales: ["es"] });
    const again = await useCase.execute({
      actor,
      texts: [{ key: { family: "fit.policies.reassurance", locale: "es" }, text: "Edited in the file." }],
      locales: ["es"],
    });
    expect(again).toEqual({ ok: true, value: { outcome: "skipped" } });
    expect(
      (await texts.inForce(undefined, { family: "fit.policies.reassurance", locale: "es" }))?.version,
    ).toBe(1);
  });

  it("refuses a seed that leaves the base incomplete in a language the levels support, naming the families", async () => {
    const texts = memoryTextStore();
    const [, ...allButOne] = completeIn("es");
    const done = await new ImportTextsUseCase({ texts, clock }).execute({
      actor,
      texts: allButOne,
      locales: ["es"],
    });
    expect(done.ok).toBe(false);
    if (done.ok) return;
    expect(done.error.code).toBe("locale-incomplete");
    expect(done.error.details).toEqual({
      locale: "es",
      missing: TextKey.unconditionalFamilies()[0],
      problem: `es: ${TextKey.unconditionalFamilies()[0] ?? ""}`,
    });
  });

  it("refuses a seed complete in one language when the levels support another too", async () => {
    const texts = memoryTextStore();
    const done = await new ImportTextsUseCase({ texts, clock }).execute({
      actor,
      texts: completeIn("es"),
      locales: ["es", "en"],
    });
    expect(done.ok ? undefined : done.error.details["locale"]).toBe("en");
  });

  it("refuses a text the domain refuses, naming the key or the rule", async () => {
    const texts = memoryTextStore();
    const stray = await new ImportTextsUseCase({ texts, clock }).execute({
      actor,
      texts: [{ key: { family: "fit.policies.reassurence", locale: "es" }, text: "A text." }],
      locales: [],
    });
    expect(stray.ok ? undefined : stray.error.code).toBe("text-key-unknown");
    const empty = await new ImportTextsUseCase({ texts, clock }).execute({
      actor,
      texts: [{ key: { family: "fit.policies.reassurance", locale: "es" }, text: "  " }],
      locales: [],
    });
    expect(empty.ok ? undefined : empty.error.code).toBe("corpus-text-empty");
  });
});
