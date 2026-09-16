import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { PROBLEM_NAMESPACE, PROBLEM_TYPES, problem } from "../../src/adapters/http/problem-details.js";

interface Catalog {
  namespace: string;
  types: { slug: string; status: number; title: string }[];
}

const catalog = parse(readFileSync(path.resolve("contracts/problem-types.yaml"), "utf8")) as Catalog;

describe("catálogo de tipos de problema", () => {
  it("el código replica exactamente contracts/problem-types.yaml", () => {
    expect(PROBLEM_NAMESPACE).toBe(catalog.namespace);
    const fromCatalog = Object.fromEntries(
      catalog.types.map((t) => [t.slug, { status: t.status, title: t.title }]),
    );
    expect(PROBLEM_TYPES).toEqual(fromCatalog);
  });
});

describe("problem()", () => {
  it("arma un Problem Details con type del catálogo y status coherente", () => {
    const res = problem("validation-failed", {
      instance: "/v1/health",
      errors: [{ pointer: "/query/x", message: "must NOT have additional properties" }],
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      type: "urn:ope:problem:validation-failed",
      title: "El request no cumple el contrato",
      status: 400,
      instance: "/v1/health",
      errors: [{ pointer: "/query/x", message: "must NOT have additional properties" }],
    });
  });

  it("nunca incluye claves fuera del esquema ProblemDetails", () => {
    const allowed = ["type", "title", "status", "detail", "instance", "errors"];
    for (const slug of Object.keys(PROBLEM_TYPES) as (keyof typeof PROBLEM_TYPES)[]) {
      const { body } = problem(slug, { detail: "d" });
      for (const key of Object.keys(body)) expect(allowed).toContain(key);
      expect(body.status).toBe(PROBLEM_TYPES[slug].status);
    }
  });
});
