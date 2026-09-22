// Gate adapter `lint` (findings-v1, ADR-032): ESLint on the files of the scope, with the src-only
// rules applied by flag when the files are not under src/ (an eval fixture with its own tree).
// `--list-rules`: every rule id eslint.config.mjs names in any of its blocks.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { capture, repoRoot } from "../lib.mjs";
import { emitFindings, emitRules, fail, invocation } from "./lib.mjs";

const config = await import(pathToFileURL(path.join(repoRoot, "eslint.config.mjs")).href);
const { SRC_ONLY_RULES } =
  /** @type {{ SRC_ONLY_RULES: Record<string, unknown>; default: { rules?: Record<string, unknown> }[] }} */ (
    config
  );

const call = invocation(process.argv.slice(2));
if (call.listRules) {
  const blocks = /** @type {{ rules?: Record<string, unknown> }[]} */ (config.default);
  emitRules(blocks.flatMap((block) => Object.keys(block.rules ?? {})));
} else if (call.files.length === 0) {
  emitFindings([]);
} else {
  const eslint = path.join(repoRoot, "node_modules", "eslint", "bin", "eslint.js");
  const underSrc = call.files.every((f) => f.startsWith("src/"));
  const srcOnly = underSrc
    ? []
    : Object.entries(SRC_ONLY_RULES).flatMap(([rule, level]) => [
        "--rule",
        JSON.stringify({ [rule]: level }),
      ]);
  // Files are explicit: `--no-ignore` lets the eval fixtures (under an ignored folder) be linted.
  const r = capture(process.execPath, [eslint, "--no-ignore", "--format", "json", ...srcOnly, ...call.files]);
  /** @type {{ filePath: string; messages: { line: number; ruleId: string | null; message: string }[] }[]} */
  let results;
  try {
    results = JSON.parse(r.stdout);
  } catch {
    fail(`eslint did not answer JSON: ${(r.stderr || r.stdout).split(/\r?\n/u)[0] ?? ""}`);
  }
  emitFindings(
    results.flatMap((f) =>
      f.messages.map((m) => ({
        file: path.relative(repoRoot, f.filePath).split(path.sep).join("/"),
        line: m.line,
        rule: `lint/${m.ruleId ?? "parse"}`,
        message: m.message,
      })),
    ),
  );
}
