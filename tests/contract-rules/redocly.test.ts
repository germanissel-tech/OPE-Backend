// US5 (FR-030): the schema of a media type is always a $ref. Redocly assertion (redocly.yaml),
// verified on the source files, with file and line.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface Problem {
  ruleId: string;
  severity: string;
  location: { source: { ref: string }; pointer: string; start: { line: number } }[];
}

function lint(file: string): Problem[] {
  const args = [
    path.resolve("node_modules/@redocly/cli/bin/cli.js"),
    "lint",
    path.resolve("tests/contract-rules/redocly", file),
    "--config",
    path.resolve("redocly.yaml"),
    "--format",
    "json",
  ];
  let out: string;
  try {
    out = execFileSync(process.execPath, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch (err) {
    out = (err as { stdout: string }).stdout;
  }
  return (JSON.parse(out) as { problems: Problem[] }).problems;
}

const RULE = "rule/media-type-schema-ref";

describe("rule/media-type-schema-ref (Redocly)", () => {
  it.each(["inline-request.yaml", "inline-response.yaml"])("%s fails with file and line", (file) => {
    const hits = lint(file).filter((p) => p.ruleId === RULE);
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.severity).toBe("error");
      expect(hit.location[0]?.source.ref).toContain(file);
      expect(hit.location[0]?.start.line).toBeGreaterThan(0);
      expect(hit.location[0]?.pointer).toContain("/schema");
    }
  });

  it("valid.yaml pasa", () => {
    expect(lint("valid.yaml").filter((p) => p.ruleId === RULE)).toEqual([]);
  });
});
