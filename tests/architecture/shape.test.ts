// Feature 005, US5 (FR-040, FR-041; ADR-016): the rings have a shape, not only a direction. Each rule runs on
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
  noComputedDynamicImport: (root: string) => string[];
  noConfigBranchInRoot: (root: string) => string[];
  noRawControlCharacters: (root: string) => string[];
  compositionModuleShape: (root: string) => string[];
  portImplementationsOnlyInBind: (root: string) => string[];
}

let MAX_RING_FILE_LINES: number;
let kebab: Rules["kebab"];
let maxFileLines: Rules["maxFileLines"];
let oneControllerPerOperation: Rules["oneControllerPerOperation"];
let newOnlyInComposition: Rules["newOnlyInComposition"];
let noComputedDynamicImport: Rules["noComputedDynamicImport"];
let noConfigBranchInRoot: Rules["noConfigBranchInRoot"];
let noRawControlCharacters: Rules["noRawControlCharacters"];
let compositionModuleShape: Rules["compositionModuleShape"];
let portImplementationsOnlyInBind: Rules["portImplementationsOnlyInBind"];
beforeAll(async () => {
  const mod = (await import(pathToFileURL(path.resolve("scripts/shape-rules.mjs")).href)) as Rules;
  ({
    MAX_RING_FILE_LINES,
    kebab,
    maxFileLines,
    oneControllerPerOperation,
    newOnlyInComposition,
    noComputedDynamicImport,
    noConfigBranchInRoot,
    noRawControlCharacters,
    compositionModuleShape,
    portImplementationsOnlyInBind,
  } = mod);
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
      "interface-adapters/<module>/controllers/create-thing.ts: missing controller for operationId createThing",
      "interface-adapters/<module>/controllers/list-things.ts: missing controller for operationId listThings",
      "interface-adapters/x/controllers/two-ops.ts: no operationId in the contract maps to this controller",
    ]);
  });

  it("src/ instantiates npm packages only in composition, infrastructure and gateways", () => {
    expect(newOnlyInComposition(src)).toEqual([]);
  });

  it("a controller building an npm client is reported; builtins and domain classes are not", () => {
    expect(newOnlyInComposition(fixture("new-outside"))).toEqual([
      "interface-adapters/x/controllers/bad-new.ts:7: instantiates Redis from an npm package outside composition",
    ]);
    expect(newOnlyInComposition(fixture("new-allowed"))).toEqual([]);
  });

  it("src/ has no dynamic import() with a computed specifier", () => {
    expect(noComputedDynamicImport(src)).toEqual([]);
  });

  it("a module loaded from a runtime value is reported; a literal dynamic import is not", () => {
    expect(noComputedDynamicImport(fixture("dynamic-import"))).toEqual([
      "composition/bad-import.ts:7: dynamic import() of a computed specifier (pathToFileURL(file).href)",
    ]);
  });

  // Feature 020, US2 (FR-008; ADR-033): a module of composition exports its components and
  // itself, and nothing else — a factory another module could call without the graph is a side
  // channel the context map cannot judge.
  it("every module of composition exports only its ports and itself; a factory is reported", () => {
    expect(compositionModuleShape(src)).toEqual([]);
    expect(compositionModuleShape(fixture("composition-module-shape"))).toEqual([
      "composition/modules/ledger.ts:5: a module of composition exports function; only its ports and itself",
    ]);
  });

  // Feature 020, US3 (FR-015; ADR-033): the implementation of a port is built inside the builder
  // of its binding and nowhere else — a gateway instantiated in what the module serves is a
  // component the graph does not know it has, and nothing can replace it.
  it("src/ builds every implementation inside a binding; a fixture that does not is reported", () => {
    expect(portImplementationsOnlyInBind(src)).toEqual([]);
    expect(portImplementationsOnlyInBind(fixture("port-outside-bind"))).toEqual([
      "composition/modules/merchant.ts:6: writes an implementation outside the builder of a binding",
      "composition/modules/merchant.ts:12: builds MemoryMerchantStore outside the builder of a binding",
    ]);
  });

  it("src/ has no raw control character; a fixture with a raw U+001F is reported", () => {
    expect(noRawControlCharacters(src)).toEqual([]);
    expect(noRawControlCharacters(fixture("control-character"))).toEqual([
      "domain/demo/key.ts:2: raw control character U+001F; write it as an escape",
    ]);
  });

  it("the composition root of src/ takes no decision on configuration", () => {
    expect(noConfigBranchInRoot(src)).toEqual([]);
  });

  it("a root that branches on a config field is reported per line; passing a field on and config.ts are not", () => {
    expect(noConfigBranchInRoot(fixture("config-branch"))).toEqual([
      "composition/bootstrap.ts:9: the composition root branches on configuration (config.mode ===)",
      "composition/bootstrap.ts:10: the composition root branches on configuration (if (config.mode)",
    ]);
  });

  it("the module public-API rule keeps its fixture (FR-041)", () => {
    expect(
      existsSync(path.resolve("tests/architecture/fixtures/src/application/ledger/bad-internal-import.ts")),
    ).toBe(true);
  });
});
