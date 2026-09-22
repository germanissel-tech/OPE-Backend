// Gate adapter `arch` (findings-v1, ADR-032): dependency-cruiser on the source root of the scope
// (src/, or the fixture's own tree), findings narrowed to the files; a violation is located at
// the import line of the offending dependency. `--list-rules`: every forbidden rule of
// .dependency-cruiser.cjs, the context-map ones included.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { capture, repoRoot } from "../lib.mjs";
import { emitFindings, emitRules, fail, invocation, sourceRootOf } from "./lib.mjs";

const require = createRequire(import.meta.url);

const call = invocation(process.argv.slice(2));
if (call.listRules) {
  const config = /** @type {{ forbidden?: { name: string }[] }} */ (
    require(path.join(repoRoot, ".dependency-cruiser.cjs"))
  );
  emitRules((config.forbidden ?? []).map((rule) => rule.name));
} else {
  const root = sourceRootOf(call.files);
  const depcruise = path.join(
    repoRoot,
    "node_modules",
    "dependency-cruiser",
    "bin",
    "dependency-cruiser.mjs",
  );
  const r = capture(process.execPath, [
    depcruise,
    "--config",
    ".dependency-cruiser.cjs",
    "--output-type",
    "json",
    root,
  ]);
  /** @type {{ summary: { violations: { rule: { name: string }; from: string; to: string }[] } }} */
  let report;
  try {
    report = JSON.parse(r.stdout);
  } catch {
    fail(`dependency-cruiser did not answer JSON: ${(r.stderr || r.stdout).split(/\r?\n/u)[0] ?? ""}`);
  }
  const scope = new Set(call.files);
  emitFindings(
    report.summary.violations
      .filter((v) => scope.size === 0 || scope.has(v.from) || scope.has(v.to))
      .map((v) => ({
        file: v.from,
        line: importLine(v.from, v.to),
        rule: `arch/${v.rule.name}`,
        message: `${v.from} -> ${v.to}`,
      })),
  );
}

/**
 * The line of the import that names the dependency (by its base name), or 1.
 * @param {string} from repo-relative
 * @param {string} to repo-relative
 * @returns {number}
 */
function importLine(from, to) {
  const file = path.join(repoRoot, from);
  if (!existsSync(file)) return 1;
  const base = path.basename(to).replace(/\.(ts|js|mjs|cjs)$/u, "");
  const lines = readFileSync(file, "utf8").split(/\r?\n/u);
  const index = lines.findIndex((l) => /\b(import|require)\b/u.test(l) && l.includes(base));
  return index === -1 ? 1 : index + 1;
}
