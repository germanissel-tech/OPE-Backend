// check:behaviour-constants — no policy lives in the code (constitution XI; feature 017, FR-016):
// the files that once held behaviour constants (freshness budgets, level thresholds, the
// deduplication and memory windows, the signature window, the default policies) no longer
// exist under src/, and no file of src/ declares a constant with one of those names again.
// Their values are the levels of the release (config/platform.json, config/treatment-defaults.json).
//
//   node scripts/check-behaviour-constants.mjs [--src <dir>] [--json]
import { readFileSync } from "node:fs";
import path from "node:path";
import { argString, exists, parseArgs, rel, walkFiles } from "./governance-lib.mjs";
import { repoRoot } from "./lib.mjs";

/** The files of the table of retired constants (specs/017, contracts/configuration-levels.md). */
const RETIRED_FILES = [
  "application/catalog/policies/freshness.ts",
  "application/catalog/policies/sync-level.ts",
  "application/ingestion/policies/dedup-window.ts",
  "application/decision/policies/session-window.ts",
  "application/decision/policies/visitor-window.ts",
  "application/merchant/policies/signature-window.ts",
  "domain/decision/default-policy.ts",
  "domain/commercial/default-commercial-policy.ts",
];

/** The names that governed behaviour, with what governs it now. */
const RETIRED_NAMES = {
  FRESHNESS_BUDGET: "treatment defaults: freshness",
  RECEIPTS_KEPT: "treatment defaults: syncLevel.receiptsKept",
  DEDUP_WINDOW: "platform: dedupWindow",
  SESSION_WINDOW: "platform: sessionWindowMs",
  VISITOR_WINDOW: "platform: visitorWindowMs",
  SIGNATURE_WINDOW_MS: "platform: signatureWindowMs",
  CLOCK_SKEW_TOLERANCE_MS: "platform: clockSkewToleranceMs",
  DEFAULT_DECISION_POLICY: "treatment defaults: decisionPolicy",
  DEFAULT_COMMERCIAL_POLICY: "treatment defaults: commercialPolicy",
  DEFAULT_TREATMENT_PERCENT: "the seed and the API require the share",
  ROTATION_GRACE_MAX_MS: "platform: rotationGraceMaxMs",
  DIAGNOSTICS_KEPT: "platform: anchorDiagnosticsKept",
};

const args = parseArgs(process.argv.slice(2));
const src = path.resolve(argString(args, "src") ?? path.join(repoRoot, "src"));
const json = args["json"] === true;

/** @type {string[]} */
const problems = [];
for (const file of RETIRED_FILES) {
  if (exists(path.join(src, file)))
    problems.push(`${file} exists: its values belong to the levels of the release`);
}
const declaration = new RegExp(
  `\\b(?:const|let|var|function|class)\\s+(${Object.keys(RETIRED_NAMES).join("|")})\\b`,
);
for (const file of walkFiles(src, [".ts"])) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const m = declaration.exec(line);
    if (m?.[1] !== undefined) {
      const name = /** @type {keyof typeof RETIRED_NAMES} */ (m[1]);
      problems.push(
        `${rel(src, file)}:${i + 1}: declares ${name}; it is configuration now (${RETIRED_NAMES[name]})`,
      );
    }
  });
}

if (json) {
  console.log(
    JSON.stringify({
      gate: "behaviour-constants",
      mode: "blocking",
      status: problems.length === 0 ? "pass" : "fail",
      findings: problems.map((message) => ({ message })),
    }),
  );
  process.exit(problems.length === 0 ? 0 : 1);
}
if (problems.length > 0) {
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    `check:behaviour-constants — ${problems.length} problem(s): no policy lives in the code (constitution XI).`,
  );
  process.exit(1);
}
console.log(
  `check:behaviour-constants — ${RETIRED_FILES.length} retired files absent, ${Object.keys(RETIRED_NAMES).length} names never declared.`,
);
