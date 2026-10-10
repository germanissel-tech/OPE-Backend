// Feature 043 (ADR-046): a request whose only fault is a missing parameter that declares x-when-missing is
// answered with that problem instead of 400. Anything else —another error alongside, another keyword, a
// parameter without the extension, an extension naming no type of the catalogue— falls back to 400.
import { describe, expect, it } from "vitest";
import { problemOfMissing } from "../../../src/infrastructure/http/dispatch.js";
import type { ErrorObject } from "ajv";

const missing = (property: string): ErrorObject => ({
  keyword: "required",
  instancePath: "/header",
  schemaPath: "#/required",
  params: { missingProperty: property },
  message: `must have required property '${property}'`,
});

const ifMatch = { name: "If-Match", in: "header", required: true, "x-when-missing": "witness-required" };

describe("problemOfMissing", () => {
  it("names the problem of the parameter, whatever the case the validator used for its name", () => {
    expect(problemOfMissing([missing("if-match")], [ifMatch])).toBe("witness-required");
  });

  it("falls back when it is not the only fault, or not an absence", () => {
    const other: ErrorObject = { ...missing("content"), instancePath: "/requestBody" };
    expect(problemOfMissing([missing("if-match"), other], [ifMatch])).toBeUndefined();
    expect(problemOfMissing([{ ...missing("if-match"), keyword: "type" }], [ifMatch])).toBeUndefined();
    expect(problemOfMissing([{ ...missing("if-match"), params: {} }], [ifMatch])).toBeUndefined();
    expect(problemOfMissing([], [ifMatch])).toBeUndefined();
  });

  it("falls back when the parameter declares no problem, or one the catalogue does not have", () => {
    const plain = { name: ifMatch.name, in: ifMatch.in, required: ifMatch.required };
    expect(problemOfMissing([missing("if-match")], [plain])).toBeUndefined();
    expect(
      problemOfMissing([missing("if-match")], [{ ...ifMatch, "x-when-missing": "witness-forgotten" }]),
    ).toBeUndefined();
    expect(problemOfMissing([missing("if-match")], [{ ...ifMatch, "x-when-missing": 428 }])).toBeUndefined();
    expect(problemOfMissing([missing("x-other")], [ifMatch, null, "If-Match"])).toBeUndefined();
    // An operation that declares no parameters has none whose absence could have a problem of its own.
    expect(problemOfMissing([missing("if-match")], undefined)).toBeUndefined();
  });
});
