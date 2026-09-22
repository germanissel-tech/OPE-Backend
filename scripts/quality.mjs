// quality — every deterministic gate in one command (ADR-016, FR-050).
//
//   node scripts/quality.mjs          # lint → arch → check:duplication → check:dead-code → check:language → check:behaviour-constants → check:ports-bound
//   node scripts/quality.mjs --json   # { gates: [<each gate's own JSON>] }, all of them, no early stop
//
// Without --json it stops at the first red gate and names it on the first line of its output.
// `test:mutation` is not in the chain: it costs minutes and runs on its own in CI.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "./governance-lib.mjs";
import { capture, repoRoot, run } from "./lib.mjs";

/** @typedef {{ name: string; script: string; args: string[] }} Gate */

/** In order: cheap and broad first, so a red gate is found fast. */
export const GATES = /** @type {readonly Gate[]} */ ([
  { name: "lint", script: "eslint", args: ["."] },
  { name: "arch", script: "dependency-cruiser", args: ["--config", ".dependency-cruiser.cjs", "src"] },
  { name: "check:duplication", script: "check-duplication.mjs", args: [] },
  { name: "check:dead-code", script: "check-dead-code.mjs", args: [] },
  { name: "check:language", script: "check-language.mjs", args: [] },
  { name: "check:behaviour-constants", script: "check-behaviour-constants.mjs", args: [] },
  { name: "check:ports-bound", script: "check-ports-bound.mjs", args: [] },
]);

/** How a gate is launched: node_modules CLIs by their entry file, repo scripts by path. */
const ENTRIES = {
  eslint: path.join(repoRoot, "node_modules", "eslint", "bin", "eslint.js"),
  "dependency-cruiser": path.join(
    repoRoot,
    "node_modules",
    "dependency-cruiser",
    "bin",
    "dependency-cruiser.mjs",
  ),
};

/**
 * @param {Gate} gate
 * @param {string[]} extra
 * @returns {string[]} the node arguments that run the gate
 */
export function commandOf(gate, extra = []) {
  const entry =
    gate.script in ENTRIES
      ? ENTRIES[/** @type {keyof typeof ENTRIES} */ (gate.script)]
      : path.join(repoRoot, "scripts", gate.script);
  return [entry, ...gate.args, ...extra];
}

/**
 * Runs the gates in order with `runner`, stopping at the first failure.
 * @param {(gate: Gate) => number} runner exit code of the gate
 * @param {readonly Gate[]} [gates]
 * @returns {{ failed: Gate | null; ran: string[] }}
 */
export function runQuality(runner, gates = GATES) {
  /** @type {string[]} */
  const ran = [];
  for (const gate of gates) {
    ran.push(gate.name);
    if (runner(gate) !== 0) return { failed: gate, ran };
  }
  return { failed: null, ran };
}

/** Gates that speak JSON when asked; the others report pass/fail only. */
const JSON_CAPABLE = new Set([
  "check:duplication",
  "check:dead-code",
  "check:language",
  "check:behaviour-constants",
  "check:ports-bound",
]);

/** @returns {number} */
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args["json"] === true) {
    const gates = GATES.map((gate) => {
      if (JSON_CAPABLE.has(gate.name)) {
        const r = capture(process.execPath, commandOf(gate, ["--json"]));
        try {
          return /** @type {unknown} */ (JSON.parse(r.stdout));
        } catch {
          return {
            gate: gate.name,
            mode: "blocking",
            status: "fail",
            findings: [],
            error: r.stderr || r.stdout,
          };
        }
      }
      const r = capture(process.execPath, commandOf(gate));
      return {
        gate: gate.name,
        mode: "blocking",
        status: r.status === 0 ? "pass" : "fail",
        findings: [],
        output: `${r.stdout}${r.stderr}`.trim(),
      };
    });
    console.log(JSON.stringify({ gates }));
    return gates.every((g) => /** @type {{ status?: string }} */ (g).status === "pass") ? 0 : 1;
  }
  const { failed, ran } = runQuality((gate) => {
    console.log(`quality: ${gate.name}`);
    return run(process.execPath, commandOf(gate));
  });
  if (failed) {
    console.error(`quality: ${failed.name} failed (after ${ran.length - 1} green gate(s)).`);
    return 1;
  }
  console.log(`quality: ${ran.length} gates green.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exit(main());
}
