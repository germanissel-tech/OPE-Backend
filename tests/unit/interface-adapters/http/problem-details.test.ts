// Problem Details (RFC 9457): the response a catalogue type builds — its keys are the contract's
// and its status the catalogue's. The catalogue itself is generated from contracts/problem-types.yaml
// (feature 018): nothing to replicate, nothing to compare.
import { describe, expect, it } from "vitest";
import { PROBLEM_TYPES, problem } from "../../../../src/interface-adapters/http/problem-details.js";

describe("problem()", () => {
  it("builds a Problem Details with a catalogue type and a consistent status", () => {
    const res = problem("validation-failed", {
      instance: "/v1/health",
      errors: [{ pointer: "/query/x", message: "must NOT have additional properties" }],
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      type: "urn:ope:problem:validation-failed",
      title: "The request does not satisfy the contract",
      status: 400,
      instance: "/v1/health",
      errors: [{ pointer: "/query/x", message: "must NOT have additional properties" }],
    });
  });

  it("never includes keys outside the ProblemDetails schema", () => {
    const allowed = ["type", "title", "status", "detail", "instance", "errors"];
    for (const slug of Object.keys(PROBLEM_TYPES) as (keyof typeof PROBLEM_TYPES)[]) {
      const { body } = problem(slug, { detail: "d" });
      for (const key of Object.keys(body)) expect(allowed).toContain(key);
      expect(body.status).toBe(PROBLEM_TYPES[slug].status);
    }
  });
});
