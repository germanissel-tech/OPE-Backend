// contract:docs — self-contained static documentation from the bundle (FR-032).
// Refuses if the full contract verification fails: documentation of an invalid contract is
// never published.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bundlePath, repoRoot, run, runCli } from "./lib.mjs";

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
const status = runCli("redocly", [
  "build-docs",
  bundlePath,
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
