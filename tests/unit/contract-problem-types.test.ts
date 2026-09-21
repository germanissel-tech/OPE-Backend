// Feature 018 (US3): the catalogue of problem types is generated from contracts/problem-types.yaml
// — the runtime module and its declaration, deterministic, in the order of the catalogue — and
// the drift check refuses a generated file that no longer matches the source.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { PROBLEM_NAMESPACE, PROBLEM_TYPES } from "#generated/problem-types.js";

interface Catalogue {
  namespace: string;
  types: { slug: string; status: number; title: string }[];
}
interface Generator {
  generateProblemTypes: (file?: string) => { js: string; dts: string };
  renderProblemTypes: (catalogue: Catalogue) => { js: string; dts: string };
}

const catalog = parse(readFileSync(path.resolve("contracts/problem-types.yaml"), "utf8")) as Catalogue;
const script = path.resolve("scripts/contract-types-check.mjs");

let generateProblemTypes: Generator["generateProblemTypes"];
let renderProblemTypes: Generator["renderProblemTypes"];
beforeAll(async () => {
  const mod = (await import(
    pathToFileURL(path.resolve("scripts/contract-problem-types-lib.mjs")).href
  )) as Generator;
  ({ generateProblemTypes, renderProblemTypes } = mod);
});

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe("generated/problem-types", () => {
  it("is the catalogue: same namespace, same slugs in the same order, same status and title", () => {
    expect(PROBLEM_NAMESPACE).toBe(catalog.namespace);
    expect(Object.keys(PROBLEM_TYPES)).toEqual(catalog.types.map((t) => t.slug));
    for (const t of catalog.types) {
      expect(PROBLEM_TYPES[t.slug as keyof typeof PROBLEM_TYPES]).toEqual({
        status: t.status,
        title: t.title,
      });
    }
    expect(Object.isFrozen(PROBLEM_TYPES)).toBe(true);
  });

  it("the generator is deterministic and its declaration carries the literals", () => {
    const first = generateProblemTypes();
    const second = generateProblemTypes();
    expect(second).toEqual(first);
    expect(first.js).toContain('"validation-failed": Object.freeze({ status: 400, title: ');
    expect(first.dts).toContain('readonly "validation-failed": { readonly status: 400; readonly title: ');
    expect(first.dts).toContain("export type ProblemSlug = keyof typeof PROBLEM_TYPES;");
    expect(first.js.endsWith("\n")).toBe(true);
    expect(first.js).not.toContain("\r");
    // A slug that is an identifier stays unquoted; one with a dash is quoted.
    const { js } = renderProblemTypes({
      namespace: "urn:x:",
      types: [
        { slug: "plain", status: 400, title: "a" },
        { slug: "with-dash", status: 500, title: "b" },
      ],
    });
    expect(js).toContain('  plain: Object.freeze({ status: 400, title: "a" }),');
    expect(js).toContain('  "with-dash": Object.freeze({ status: 500, title: "b" }),');
  });

  it("the drift check refuses a generated catalogue that was edited by hand", () => {
    dir = mkdtempSync(path.join(os.tmpdir(), "ope-problem-types-"));
    const js = path.join(dir, "problem-types.js");
    const { js: source, dts } = generateProblemTypes();
    writeFileSync(js, `${source}// edited\n`);
    writeFileSync(js.replace(/\.js$/, ".d.ts"), dts);
    const run = (): { status: number; output: string } => {
      try {
        const output = execFileSync(process.execPath, [script], {
          encoding: "utf8",
          env: { ...process.env, OPE_PROBLEM_TYPES_FILE: js },
          stdio: ["ignore", "pipe", "pipe"],
        });
        return { status: 0, output };
      } catch (err) {
        const e = err as { status: number; stdout?: string; stderr?: string };
        return { status: e.status, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
      }
    };
    const result = run();
    expect(result.status).toBe(1);
    expect(result.output).toContain("problem-types.js does not match the contract");
  });
});
