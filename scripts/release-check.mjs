// release-check — the gate before publishing: the whole contract verification plus the
// absence of blocking markers (FR-023). A contract marked building (info.x-stability) is not
// blocking, but it is said out loud: the mark must go before the first pilot (ADR-003).
import path from "node:path";
import { prop, readYaml } from "./governance-lib.mjs";
import { contractRoot, repoRoot, run } from "./lib.mjs";

const npmCli = process.env.npm_execpath;
const check = npmCli
  ? run(process.execPath, [npmCli, "run", "contract:check"])
  : run("npm", ["run", "contract:check"], { shell: true });
if (check !== 0) {
  console.error("release-check: contract:check failed.");
  process.exit(check);
}
const markers = run(process.execPath, [path.join(repoRoot, "scripts", "check-markers.mjs"), "--strict"]);
if (markers !== 0) process.exit(markers);
const stability = prop(prop(readYaml(contractRoot), "info"), "x-stability");
if (stability !== undefined) {
  console.warn(
    `warning: the contract is marked ${String(stability)} (info.x-stability): incompatible changes pass contract:diff without a major bump; remove the mark before the first pilot.`,
  );
}
console.log("release-check: OK");
