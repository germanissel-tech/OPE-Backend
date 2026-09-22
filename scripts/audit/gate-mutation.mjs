// Gate adapter `mutation` (findings-v1, ADR-032): scripts/mutation-diff.mjs --json, repository-wide, with its
// findings narrowed to the files of the scope. `--list-rules`: the rule ids the script emits.
import path from "node:path";
import { capture, repoRoot } from "../lib.mjs";
import { emitFindings, emitRules, fail, inScope, invocation } from "./lib.mjs";

// Stryker names the mutator in the rule (`mutation/<mutator>`); the list is the mutators of the config.
const RULES = ["mutation/*"];

// Mutation is slow and judges a change, not a module: informative, on the diff scope only.
const call = invocation(process.argv.slice(2), { mode: "informative", scopes: ["diff"] });
if (call.listRules) {
  emitRules(RULES);
} else if (call.files.length === 0) {
  // Nothing in scope, nothing to mutate: a full run of Stryker to answer "no findings in no
  // files" costs minutes (it is what the doctor asks when it probes whether the gate answers).
  emitFindings([]);
} else {
  const r = capture(process.execPath, [path.join(repoRoot, "scripts", "mutation-diff.mjs"), "--json"]);
  /** @type {{ findings: { file: string; line?: number; rule: string; message: string; mode?: string }[]; error?: string }} */
  let parsed;
  // Stryker warns on its own stdout about anything in its config it does not know (the `$comment`
  // keys that say why each option is there): the answer is the line that parses, not the whole
  // output.
  const answer = r.stdout
    .split(/\r?\n/u)
    .reverse()
    .find((line) => line.trimStart().startsWith("{"));
  try {
    parsed = JSON.parse(answer ?? "");
  } catch {
    fail(`mutation-diff.mjs did not answer JSON: ${(r.stderr || r.stdout).split(/\r?\n/u)[0] ?? ""}`);
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
