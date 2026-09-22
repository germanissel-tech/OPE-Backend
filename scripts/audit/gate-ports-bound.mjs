// Gate adapter `ports-bound` (findings-v1, ADR-032/ADR-033): scripts/check-ports-bound.mjs over the
// source root of the scope. Unlike the other adapters it does not narrow a repository-wide answer:
// whether a port is bound is a property of a whole source tree, so it runs on the root the scope
// belongs to and reports the findings that fall inside it.
import path from "node:path";
import { capture, repoRoot } from "../lib.mjs";
import { emitFindings, emitRules, fail, inScope, invocation, sourceRootOf } from "./lib.mjs";

const RULES = ["ports-bound/unbound-port", "ports-bound/duplicate-label"];

const call = invocation(process.argv.slice(2));
if (call.listRules) {
  emitRules(RULES);
} else if (call.files.length === 0) {
  emitFindings([]);
} else {
  const root = sourceRootOf(call.files) ?? "src";
  const r = capture(process.execPath, [
    path.join(repoRoot, "scripts", "check-ports-bound.mjs"),
    "--src",
    path.join(repoRoot, root),
    "--json",
  ]);
  /** @type {{ findings: { file: string; line?: number; rule: string; message: string }[]; error?: string }} */
  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    fail(`check-ports-bound.mjs did not answer JSON: ${(r.stderr || r.stdout).split(/\r?\n/u)[0] ?? ""}`);
  }
  if (parsed.error !== undefined) fail(parsed.error);
  emitFindings(
    inScope(
      parsed.findings.map((f) => ({
        file: `${root}/${f.file}`,
        line: f.line ?? 1,
        rule: f.rule,
        message: f.message,
      })),
      call.files,
    ),
  );
}
