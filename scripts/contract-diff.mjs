// contract:diff — compares the bundled contract with the main branch one and fails on
// incompatible changes if the major version did not increase (FR-020).
//
//   node scripts/contract-diff.mjs                       # base: $CONTRACT_BASE_REF | origin/main | main
//   node scripts/contract-diff.mjs --base a.yaml --head b.yaml   # test mode: two files
//
// Outputs: "WARNING: no base contract, comparison skipped" (exit 0) when there is no base;
// "Expected incompatible change: major version X → Y" (exit 0) with a major bump;
// "Incompatible change accepted: the contract is building" (exit 0) while the head declares
// `info.x-stability: building` (no merchant consumes it yet; ADR-003 precision of 2026-09-20);
// "No incompatible changes" (exit 0); or the oasdiff report (exit 1).
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { argString, isRecord, parseArgs, prop, readYaml } from "./governance-lib.mjs";
import { bundlePath, capture, captureBuffer, repoRoot, runCli } from "./lib.mjs";
import { resolveOasdiff } from "./oasdiff-install.mjs";

const SEVERITY_FILE = path.join(repoRoot, "contracts", "oasdiff-severity.txt");
const HTTP_METHODS = ["get", "put", "post", "delete", "patch", "options", "head", "trace"];

/**
 * Response status codes of every operation, keyed by `method path`.
 * @param {string} file
 * @returns {Map<string, Set<string>>}
 */
function responsesByOperation(file) {
  /** @type {Map<string, Set<string>>} */
  const out = new Map();
  const paths = prop(readYaml(file), "paths");
  for (const [route, item] of Object.entries(isRecord(paths) ? paths : {})) {
    for (const method of HTTP_METHODS) {
      const responses = prop(prop(item, method), "responses");
      if (isRecord(responses)) out.set(`${method.toUpperCase()} ${route}`, new Set(Object.keys(responses)));
    }
  }
  return out;
}

/**
 * OPE check (ADR-003 as refined by ADR-021): a new 4xx on an existing operation is a new way for
 * a valid client to be rejected and is incompatible; a new 5xx is a server-side condition every
 * client has to tolerate anyway (Problem Details) and is compatible. oasdiff cannot tell them
 * apart (`response-non-success-status-added` covers both), so it stays a warning there.
 * @param {string} base
 * @param {string} head
 * @returns {string[]} one line per added client error response
 */
function addedClientErrorResponses(base, head) {
  const before = responsesByOperation(base);
  const after = responsesByOperation(head);
  /** @type {string[]} */
  const added = [];
  for (const [operation, statuses] of after) {
    const previous = before.get(operation);
    if (!previous) continue;
    for (const status of statuses) {
      if (/^4\d\d$/.test(status) && !previous.has(status))
        added.push(`${operation}: added the client error response ${status}`);
    }
  }
  return added;
}

/** The stability mark under which incompatible changes are accepted without a major bump. */
const BUILDING = "building";

/**
 * @param {string} file
 * @returns {{ version: string; major: number; building: boolean }}
 */
function majorOf(file) {
  const info = prop(readYaml(file), "info");
  const version = String(prop(info, "version") ?? "");
  const major = Number(version.split(".")[0]);
  if (!Number.isInteger(major)) throw new Error(`invalid info.version in ${file}: '${version}'`);
  return { version, major, building: prop(info, "x-stability") === BUILDING };
}

/**
 * Resolves the base git reference; null if none is available.
 * @returns {string | null}
 */
function resolveBaseRef() {
  const candidates = [process.env["CONTRACT_BASE_REF"], "origin/main", "main"].filter(
    (c) => typeof c === "string",
  );
  for (const ref of candidates) {
    const { status } = capture("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    if (status === 0) return ref;
  }
  return null;
}

/**
 * Copies contracts/ from the base reference (git only, no tar) and bundles it. Returns the bundle path or null.
 * @param {string} ref
 * @param {string} workDir
 * @returns {string | null}
 */
function bundleBase(ref, workDir) {
  const { status: hasContract } = capture("git", ["cat-file", "-e", `${ref}:contracts/openapi.yaml`]);
  if (hasContract !== 0) return null;
  const listing = capture("git", ["ls-tree", "-r", "--name-only", ref, "contracts"]);
  if (listing.status !== 0) throw new Error(`git ls-tree failed: ${listing.stderr}`);
  const files = listing.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  for (const file of files) {
    const content = captureBuffer("git", ["show", `${ref}:${file}`]);
    if (content.status !== 0) throw new Error(`git show ${ref}:${file} failed`);
    const target = path.join(workDir, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content.stdout);
  }
  const baseRoot = path.join(workDir, "contracts", "openapi.yaml");
  const out = path.join(workDir, "base-bundle.yaml");
  const status = runCli(
    "redocly",
    ["bundle", baseRoot, "-o", out, "--config", path.join(repoRoot, "redocly.yaml")],
    { stdio: "pipe" },
  );
  if (status !== 0) throw new Error(`Could not bundle the base contract (${ref})`);
  return out;
}

/** @typedef {{ base: string | null; head: string; baseLabel: string; workDir: string | null }} Pair */

/**
 * The two bundles to compare: explicit files (test mode) or the repo bundle against the base ref.
 * @param {string | undefined} baseArg
 * @param {string | undefined} headArg
 * @returns {Pair}
 */
function resolvePair(baseArg, headArg) {
  if (baseArg !== undefined || headArg !== undefined) {
    if (baseArg === undefined || headArg === undefined) {
      throw new Error("Use --base <file> and --head <file> together");
    }
    const base = path.resolve(baseArg);
    return {
      base: existsSync(base) ? base : null,
      head: path.resolve(headArg),
      baseLabel: baseArg,
      workDir: null,
    };
  }
  if (!existsSync(bundlePath)) {
    throw new Error(`${bundlePath} does not exist. Run npm run contract:bundle first.`);
  }
  const ref = resolveBaseRef();
  if (!ref) return { base: null, head: bundlePath, baseLabel: "(no base branch)", workDir: null };
  const workDir = mkdtempSync(path.join(os.tmpdir(), "ope-contract-base-"));
  return { base: bundleBase(ref, workDir), head: bundlePath, baseLabel: ref, workDir };
}

/**
 * Compares two bundles: a major bump is reported and passes; a breaking change is reported and
 * passes while the head is marked building; otherwise any breaking change fails.
 * @param {string} oasdiff
 * @param {string} base
 * @param {string} head
 * @returns {number}
 */
function compare(oasdiff, base, head) {
  const baseVersion = majorOf(base);
  const headVersion = majorOf(head);
  if (headVersion.major > baseVersion.major) {
    const changelog = capture(oasdiff, ["changelog", base, head, "--format", "text"]);
    process.stdout.write(changelog.stdout);
    console.log(`Expected incompatible change: major version ${baseVersion.major} → ${headVersion.major}`);
    return 0;
  }
  const result = capture(oasdiff, [
    "breaking",
    base,
    head,
    "--fail-on",
    "ERR",
    "--format",
    "text",
    "--severity-levels",
    SEVERITY_FILE,
  ]);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  const clientErrors = addedClientErrorResponses(base, head);
  for (const line of clientErrors) console.error(`error\t[ope-client-error-response-added] ${line}`);
  if (result.status !== 0 || clientErrors.length > 0) {
    if (headVersion.building) {
      console.log(
        `Incompatible change accepted: the contract is building (info.x-stability: ${BUILDING}, ${headVersion.version}); remove the mark before the first pilot.`,
      );
      return 0;
    }
    console.error(
      `contract:diff — incompatible changes without a major version bump (${headVersion.version}). Fix the contract or raise info.version to ${baseVersion.major + 1}.0.0 and the path prefix to /v${baseVersion.major + 1}/.`,
    );
    return result.status !== 0 ? result.status : 1;
  }
  console.log("No incompatible changes");
  return 0;
}

/** @returns {Promise<number>} */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pair = resolvePair(argString(args, "base"), argString(args, "head"));
  try {
    if (!pair.base) {
      console.log(`WARNING: no base contract at ${pair.baseLabel}, comparison skipped`);
      return 0;
    }
    const oasdiff = await resolveOasdiff();
    console.log(
      `contract:diff — base ${pair.baseLabel} (${majorOf(pair.base).version}) → head (${majorOf(pair.head).version})`,
    );
    return compare(oasdiff, pair.base, pair.head);
  } finally {
    if (pair.workDir) rmSync(pair.workDir, { recursive: true, force: true });
  }
}

main()
  .then((code) => process.exit(code))
  .catch((/** @type {unknown} */ err) => {
    console.error(`contract:diff — ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  });
