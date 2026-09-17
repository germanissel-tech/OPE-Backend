// contract:docs — self-contained static documentation from the bundle (FR-032).
// Refuses if the full contract verification fails: documentation of an invalid contract is
// never published.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse, stringify } from "yaml";
import { isRecord, prop } from "./governance-lib.mjs";
import { bundlePath, repoRoot, run, runCli } from "./lib.mjs";

const apiMapPath = path.join(repoRoot, "contracts", "api-map.yaml");
const PLANNED_STATUSES = ["planned", "deprecated"];

/**
 * Appends a "Planned surface" Markdown section, generated from contracts/api-map.yaml, to the
 * info.description of a bundle (FR-005; ADR-019). Only planned and deprecated operations are
 * listed: the built ones are documented by the contract itself.
 * @param {string} bundleYaml
 * @returns {string}
 */
export function withPlannedSurface(bundleYaml) {
  const doc = /** @type {unknown} */ (parse(bundleYaml));
  const map = /** @type {unknown} */ (parse(readFileSync(apiMapPath, "utf8")));
  const operations = prop(map, "operations");
  const rows = (Array.isArray(operations) ? operations : [])
    .filter((op) => PLANNED_STATUSES.includes(String(prop(op, "status"))))
    .sort((a, b) => String(prop(a, "feature")).localeCompare(String(prop(b, "feature"))))
    .map(
      (op) =>
        `| \`${String(prop(op, "operationId"))}\` | \`${String(prop(op, "method")).toUpperCase()} ${String(prop(op, "path"))}\` | ${String(prop(op, "consumer"))} | ${String(prop(op, "feature"))} | ${String(prop(op, "status"))} | \`${String(prop(op, "source"))}\` |`,
    );
  const section = [
    "",
    "## Planned surface",
    "",
    "Every operation the backend will expose, before it is built (contract map, ADR-019). Built operations are documented below.",
    "",
    "| Operation | Method and path | Consumer | Feature | Status | Source |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
  if (!isRecord(doc) || !isRecord(doc["info"]))
    throw new Error("contract:docs — the bundle has no info object");
  const info = doc["info"];
  info["description"] = `${String(info["description"] ?? "")}${section}`;
  return stringify(doc, { lineWidth: 0 });
}

// npm_execpath is defined when this script runs via `npm run`; otherwise `npm` from PATH is used.
const npmCli = process.env.npm_execpath;
const check = npmCli
  ? run(process.execPath, [npmCli, "run", "contract:check"])
  : run("npm", ["run", "contract:check"], { shell: true });
if (check !== 0) {
  console.error("contract:docs — the contract verification failed; no documentation is generated.");
  process.exit(check);
}
const out = path.join(repoRoot, "docs", "api", "index.html");
mkdirSync(path.dirname(out), { recursive: true });
// The planned surface (ADR-019) is rendered from the contract map into a copy of the bundle;
// the committed contract and the bundle stay untouched.
const docsBundle = path.join(path.dirname(bundlePath), "openapi.docs.yaml");
writeFileSync(docsBundle, withPlannedSurface(readFileSync(bundlePath, "utf8")), "utf8");
const status = runCli("redocly", [
  "build-docs",
  docsBundle,
  "-o",
  out,
  "--config",
  path.join(repoRoot, "redocly.yaml"),
  "--disableGoogleFont",
]);
if (status !== 0) process.exit(status);

// Redocly links Redoc from its CDN. For the artefact to be self-contained (US4) the bundle of
// the same version is inlined from the `redoc` package (pinned devDependency).
const html = readFileSync(out, "utf8");
const cdnScript =
  /<script src="https:\/\/cdn\.redocly\.com\/redoc\/v([^/]+)\/bundles\/redoc\.standalone\.js"[^>]*><\/script>/;
const match = html.match(cdnScript);
if (!match) {
  console.error(
    "contract:docs — the Redoc <script> was not found in the generated HTML; check the @redocly/cli version.",
  );
  process.exit(1);
}
const redocPkg = JSON.parse(
  readFileSync(path.join(repoRoot, "node_modules", "redoc", "package.json"), "utf8"),
);
if (redocPkg.version !== match[1]) {
  console.error(
    `contract:docs — @redocly/cli expects Redoc ${match[1]} but the installed redoc package is ${redocPkg.version}. Align the devDependency.`,
  );
  process.exit(1);
}
const bundle = readFileSync(
  path.join(repoRoot, "node_modules", "redoc", "bundles", "redoc.standalone.js"),
  "utf8",
);
writeFileSync(
  out,
  html.replace(cdnScript, () => `<script>${bundle}</script>`),
  "utf8",
);
console.log(`Self-contained documentation generated at ${out}`);
