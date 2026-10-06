// Feature 038 (FR-010, FR-011; R-05): a language enters the supported list only when the base holds a text
// for every unconditional family in it. The check is a decorator around the two publications of feature
// 036: it judges only the languages that **enter**, names the families that are missing, and otherwise
// hands the request to the use case untouched.
import { describe, expect, it } from "vitest";
import { CompleteLocales, type TextCompleteness } from "../../../../src/application/configuration/index.js";
import {
  StoreUnavailable,
  fail,
  ok,
  type DomainError,
  type Result,
} from "../../../../src/domain/shared-kernel/index.js";
import type { UseCase } from "../../../../src/application/shared-kernel/index.js";
import type { Locales } from "../../../../src/domain/configuration/index.js";

interface Request {
  locales?: Locales;
}
type Response = Result<string, DomainError>;

/** The base holds every family in Spanish and English, and only some in Portuguese. */
const MISSING: Record<string, readonly string[]> = {
  "pt-BR": ["fit.policies.reassurance", "returns.policies.information"],
};

function subject(inForce: Locales | undefined) {
  const asked: string[] = [];
  const executed: Request[] = [];
  const completeness: TextCompleteness = {
    missingFor: (locale) => {
      asked.push(locale);
      return Promise.resolve(MISSING[locale] ?? []);
    },
  };
  const inner: UseCase<Request, Response> = {
    execute: (request) => {
      executed.push(request);
      return Promise.resolve(ok("published"));
    },
  };
  const useCase = new CompleteLocales(
    inner,
    { completeness },
    {
      declared: (request) => request.locales,
      inForce: () => Promise.resolve(inForce),
      at: "content.locales",
    },
  );
  return { useCase, asked, executed };
}

describe("CompleteLocales", () => {
  it("refuses a language that enters without a complete base, naming the families and where it was declared", async () => {
    const { useCase, executed } = subject({ supported: ["es"], fallback: "es" });
    const done = await useCase.execute({ locales: { supported: ["es", "pt-BR"], fallback: "es" } });
    expect(done.ok ? undefined : done.error.code).toBe("locale-incomplete");
    expect(done.ok ? undefined : done.error.details).toEqual({
      locale: "pt-BR",
      missing: "fit.policies.reassurance, returns.policies.information",
      pointer: "content.locales.supported.1",
      problem: "pt-BR: fit.policies.reassurance, returns.policies.information",
    });
    expect(executed).toEqual([]);
  });

  it("judges only what enters: a language already supported is not asked again, and one that leaves asks nothing", async () => {
    const { useCase, asked, executed } = subject({ supported: ["es", "pt-BR"], fallback: "es" });
    const kept = await useCase.execute({ locales: { supported: ["es", "pt-BR"], fallback: "es" } });
    expect(kept.ok && kept.value).toBe("published");
    const left = await useCase.execute({ locales: { supported: ["es"], fallback: "es" } });
    expect(left.ok && left.value).toBe("published");
    expect(asked).toEqual([]);
    expect(executed).toHaveLength(2);
  });

  it("with every entering language complete, hands the request to the use case as it came", async () => {
    const { useCase, asked, executed } = subject({ supported: ["es"], fallback: "es" });
    const request = { locales: { supported: ["es", "en"], fallback: "en" } };
    const done = await useCase.execute(request);
    expect(done.ok && done.value).toBe("published");
    expect(asked).toEqual(["en"]);
    expect(executed[0]).toBe(request);
  });

  it("with nothing in force yet, every declared language enters; a request that declares none asks nothing", async () => {
    const { useCase, asked } = subject(undefined);
    const first = await useCase.execute({ locales: { supported: ["es", "pt-BR"] } });
    expect(first.ok ? undefined : first.error.code).toBe("locale-incomplete");
    expect(asked).toEqual(["es", "pt-BR"]);
    const silent = await useCase.execute({});
    expect(silent.ok && silent.value).toBe("published");
    expect(asked).toEqual(["es", "pt-BR"]);
  });

  it("answers the use case's own refusal untouched", async () => {
    const refusing: UseCase<Request, Response> = {
      execute: () => Promise.resolve(fail(new StoreUnavailable("the store refused"))),
    };
    const useCase = new CompleteLocales(
      refusing,
      { completeness: { missingFor: () => Promise.resolve([]) } },
      {
        declared: (request: Request) => request.locales,
        inForce: () => Promise.resolve(undefined),
        at: "content.locales",
      },
    );
    const done = await useCase.execute({ locales: { supported: ["es"] } });
    expect(done.ok ? undefined : done.error.code).toBe("store-unavailable");
  });
});
