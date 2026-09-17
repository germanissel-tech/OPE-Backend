// US4: self-contained static documentation from the contract; deterministic; refuses if the
// contract does not pass verification (FR-032, SC-006).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve("scripts/contract-docs.mjs");
const output = path.resolve("docs/api/index.html");
const bundle = path.resolve("contracts/dist/openapi.yaml");

function docs(env: Record<string, string> = {}): { status: number; output: string } {
  const r = spawnSync(process.execPath, [script], { encoding: "utf8", env: { ...process.env, ...env } });
  return { status: r.status ?? 1, output: `${r.stdout}${r.stderr}` };
}

// Two full runs of contract:check plus two Redocly builds: ~50 s alone, more under the load of
// the whole suite. The budget is the work, not the default.
const TWO_BUILDS_TIMEOUT = 240_000;

describe("contract:docs", () => {
  it(
    "generates a self-contained HTML with the operation, example and errors, identical in two runs",
    () => {
      const bundleBefore = readFileSync(bundle, "utf8");
      const first = docs();
      expect(first.status, first.output).toBe(0);
      const html = readFileSync(output, "utf8");
      expect(html).toContain("getHealth");
      expect(html).toContain("Service status");
      expect(html).toContain("application/problem+json");
      expect(html).toContain("2026-09-16T12:00:00Z");
      // The planned surface comes from the contract map; the bundle itself stays untouched.
      expect(html).toContain("Planned surface");
      expect(html).toContain("notifyOrder");
      expect(html).toContain("listDecisions");
      expect(readFileSync(bundle, "utf8")).toBe(bundleBefore);
      // Self-contained: no remote scripts or stylesheets.
      expect(html).not.toMatch(/<script[^>]*src="https?:/);
      expect(html).not.toMatch(/<link[^>]*href="https?:/);

      const second = docs();
      expect(second.status, second.output).toBe(0);
      expect(readFileSync(output, "utf8")).toBe(html);
    },
    TWO_BUILDS_TIMEOUT,
  );

  it("refuses to generate documentation for a contract that does not pass verification", () => {
    const before = existsSync(output) ? statSync(output).mtimeMs : null;
    const result = docs({ OPE_CONTRACT_ROOT: path.resolve("tests/contract-rules/fixtures/ope-no-pii.yaml") });
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("ope-no-pii");
    expect(result.output).toContain("no documentation is generated");
    const after = existsSync(output) ? statSync(output).mtimeMs : null;
    expect(after).toBe(before);
  });
});
