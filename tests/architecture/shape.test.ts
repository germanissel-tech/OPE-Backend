// US5 (FR-040, FR-041; ADR-016): the rings have a shape, not only a direction. Each rule runs on
// src/ (must pass) and on a fixture that violates it (must fail naming the file).
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

interface Rules {
  MAX_RING_FILE_LINES: number;
  kebab: (operationId: string) => string;
  maxFileLines: (root: string) => string[];
  oneControllerPerOperation: (root: string, bundlePath: string) => string[];
  newOnlyInComposition: (root: string) => string[];
}

let MAX_RING_FILE_LINES: number;
let kebab: Rules["kebab"];
let maxFileLines: Rules["maxFileLines"];
let oneControllerPerOperation: Rules["oneControllerPerOperation"];
let newOnlyInComposition: Rules["newOnlyInComposition"];
beforeAll(async () => {
  const mod = (await import(pathToFileURL(path.resolve("scripts/shape-rules.mjs")).href)) as Rules;
  ({ MAX_RING_FILE_LINES, kebab, maxFileLines, oneControllerPerOperation, newOnlyInComposition } = mod);
});

const src = path.resolve("src");
const bundle = path.resolve("contracts/dist/openapi.yaml");
const fixture = (name: string): string => path.resolve("tests/architecture/fixtures/shape", name, "src");

describe("shape of the rings", () => {
  it("no file of domain/ or application/ in src/ exceeds the limit", () => {
    expect(MAX_RING_FILE_LINES).toBe(300);
    expect(maxFileLines(src)).toEqual([]);
  });

  it("a domain file over the limit is reported with its length", () => {
    expect(maxFileLines(fixture("too-long"))).toEqual([
      `domain/x/big.ts: 303 lines (max ${MAX_RING_FILE_LINES})`,
    ]);
  });

  it("every operationId of the contract has exactly one controller in src/, and vice versa", () => {
    expect(existsSync(bundle), "run npm run contract:bundle first").toBe(true);
    expect(kebab("confirmExposure")).toBe("confirm-exposure");
    expect(oneControllerPerOperation(src, bundle)).toEqual([]);
  });

  it("a missing controller and a controller with no operation are both reported", () => {
    const found = oneControllerPerOperation(
      fixture("controllers"),
      path.resolve("tests/architecture/fixtures/shape/controllers/openapi.yaml"),
    );
    expect(found).toEqual([
      "interface-adapters/http/controllers/<module>/create-thing.ts: missing controller for operationId createThing",
      "interface-adapters/http/controllers/<module>/list-things.ts: missing controller for operationId listThings",
      "interface-adapters/http/controllers/x/two-ops.ts: no operationId in the contract maps to this controller",
    ]);
  });

  it("src/ instantiates npm packages only in composition, infrastructure and gateways", () => {
    expect(newOnlyInComposition(src)).toEqual([]);
  });

  it("a controller building an npm client is reported; builtins and domain classes are not", () => {
    expect(newOnlyInComposition(fixture("new-outside"))).toEqual([
      "interface-adapters/http/controllers/x/bad-new.ts:7: instantiates Redis from an npm package outside composition",
    ]);
    expect(newOnlyInComposition(fixture("new-allowed"))).toEqual([]);
  });

  it("the module public-API rule keeps its fixture (FR-041)", () => {
    expect(
      existsSync(path.resolve("tests/architecture/fixtures/src/application/ledger/bad-internal-import.ts")),
    ).toBe(true);
  });
});
