// Feature 015 (F-020 of the audit 014): a test header that cites a requirement (`FR-`, `SC-`,
// `US`) names the feature the requirement belongs to, because requirement numbers restart with
// every spec — `FR-040` alone points at a dozen documents.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const HEADER_LINES = 4;
const CITES_A_REQUIREMENT = /\b(?:FR|SC)-\d|\bUS\d/;
const NAMES_A_FEATURE = /\b(?:[Ff]eature|spec) \d{3}\b/;

/** The test files under `dir`, fixtures excluded (they are inputs, not suites). */
function testFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "fixtures" && entry.name !== "node_modules") out.push(...testFiles(full));
    } else if (entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

/** The files whose header cites a requirement and names no feature. */
export function headersWithoutFeature(files: readonly string[]): string[] {
  return files.filter((file) => {
    const header = readFileSync(file, "utf8").split(/\r?\n/).slice(0, HEADER_LINES).join("\n");
    return CITES_A_REQUIREMENT.test(header) && !NAMES_A_FEATURE.test(header);
  });
}

const fixture = (name: string) => path.resolve("tests/governance/fixtures/test-headers", name);

describe("test headers name their feature", () => {
  it("a header that cites a requirement without its feature is flagged; a named one and one without citations are not", () => {
    expect(headersWithoutFeature(testFiles(fixture("bad")))).toEqual([
      path.join(fixture("bad"), "unnamed.test.ts"),
    ]);
    expect(headersWithoutFeature(testFiles(fixture("ok")))).toEqual([]);
  });

  it("every test of the repository names its feature when it cites a requirement", () => {
    expect(headersWithoutFeature(testFiles(path.resolve("tests")))).toEqual([]);
  });
});
