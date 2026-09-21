// Feature 008, US3 (FR-024; ADR-023): every business error code is unique across modules and exists in the
// problem type catalogue with the status the HTTP adapter will answer. The domain never imports
// the catalogue; this test is the bridge.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { PROBLEM_TYPES } from "#generated/problem-types.js";
import { DomainError } from "../../../src/domain/shared-kernel/index.js";

interface Catalog {
  types: { slug: string; status: number }[];
}

const catalog = parse(readFileSync(path.resolve("contracts/problem-types.yaml"), "utf8")) as Catalog;
const domain = path.resolve("src/domain");
const modules = readdirSync(domain, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

type ErrorClass = new (...args: never[]) => DomainError;

/** The exported classes of domain/<module>/errors.ts, instantiated with placeholder arguments. */
async function errorsOf(module: string): Promise<DomainError[]> {
  const file = path.join(domain, module, "errors.ts");
  let exported: Record<string, unknown>;
  try {
    exported = (await import(file)) as Record<string, unknown>;
  } catch {
    return [];
  }
  return (
    Object.values(exported)
      .filter((v): v is ErrorClass => typeof v === "function" && v.prototype instanceof DomainError)
      // Placeholder arguments: an id, an index or an instant; every message tolerates them.
      .map((Cls) => new Cls(...([new Date(0), new Date(0)] as never[])))
  );
}

describe("domain error codes replicate the problem type catalogue", () => {
  it("every code of every module exists in the catalogue with its status, and codes are unique", async () => {
    const all = (await Promise.all(modules.map(errorsOf))).flat();
    expect(all.length).toBeGreaterThan(0);
    const codes = all.map((e) => e.code);
    expect(new Set(codes).size, `duplicated codes among ${codes.join(", ")}`).toBe(codes.length);
    for (const error of all) {
      const entry = catalog.types.find((t) => t.slug === error.code);
      expect(
        entry,
        `${error.name} (${error.module}): code ${error.code} is not in problem-types.yaml`,
      ).toBeDefined();
      expect(PROBLEM_TYPES[error.code as keyof typeof PROBLEM_TYPES].status).toBe(entry?.status);
      expect(modules).toContain(error.module);
    }
  });

  it("an error declares the module of the folder it lives in", async () => {
    for (const module of modules) {
      for (const error of await errorsOf(module)) expect(error.module).toBe(module);
    }
  });
});
