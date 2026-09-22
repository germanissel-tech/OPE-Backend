// Gate adapter `language` (findings-v1, ADR-032): scripts/check-language.mjs --json, repository-wide, with its
// findings narrowed to the files of the scope. `--list-rules`: the rule ids the script emits.
import path from "node:path";
import { capture, repoRoot } from "../lib.mjs";
import { emitFindings, emitRules, fail, inScope, invocation } from "./lib.mjs";

const RULES = ["language/spanish", "language/missing-reason"];

const call = invocation(process.argv.slice(2));
if (call.listRules) {
  emitRules(RULES);
} else {
  const r = capture(process.execPath, [path.join(repoRoot, "scripts", "check-language.mjs"), "--json"]);
  /** @type {{ findings: { file: string; line?: number; rule: string; message: string; mode?: string }[]; error?: string }} */
  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    fail(`check-language.mjs did not answer JSON: ${(r.stderr || r.stdout).split(/\r?\n/u)[0] ?? ""}`);
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
