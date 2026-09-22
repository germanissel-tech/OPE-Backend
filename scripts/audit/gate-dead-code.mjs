// Gate adapter `dead-code` (findings-v1, ADR-032): scripts/check-dead-code.mjs --json, repository-wide, with its
// findings narrowed to the files of the scope. `--list-rules`: the rule ids the script emits.
import path from "node:path";
import { capture, repoRoot } from "../lib.mjs";
import { emitFindings, emitRules, fail, inScope, invocation } from "./lib.mjs";

const RULES = [
  "dead-code/binaries",
  "dead-code/dependencies",
  "dead-code/devDependencies",
  "dead-code/duplicates",
  "dead-code/exports",
  "dead-code/files",
  "dead-code/nsExports",
  "dead-code/nsTypes",
  "dead-code/types",
  "dead-code/unlisted",
  "dead-code/unresolved",
];

const call = invocation(process.argv.slice(2));
if (call.listRules) {
  emitRules(RULES);
} else {
  const r = capture(process.execPath, [path.join(repoRoot, "scripts", "check-dead-code.mjs"), "--json"]);
  /** @type {{ findings: { file: string; line?: number; rule: string; message: string; mode?: string }[]; error?: string }} */
  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    fail(`check-dead-code.mjs did not answer JSON: ${(r.stderr || r.stdout).split(/\r?\n/u)[0] ?? ""}`);
  }
  if (parsed.error !== undefined) fail(parsed.error);
  emitFindings(
    inScope(
      parsed.findings
        .filter((f) => f.mode !== "informative")
        .map((f) => ({ file: f.file, line: f.line ?? 1, rule: f.rule, message: f.message })),
      call.files,
    ),
  );
}
