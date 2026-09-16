// release-check — la puerta antes de publicar: toda la verificación del contrato más la
// ausencia de marcadores bloqueantes (FR-023).
import path from "node:path";
import { repoRoot, run } from "./lib.mjs";

const npmCli = process.env.npm_execpath;
const check = npmCli
  ? run(process.execPath, [npmCli, "run", "contract:check"])
  : run("npm", ["run", "contract:check"], { shell: true });
if (check !== 0) {
  console.error("release-check: contract:check falló.");
  process.exit(check);
}
const markers = run(process.execPath, [path.join(repoRoot, "scripts", "check-markers.mjs"), "--strict"]);
if (markers !== 0) process.exit(markers);
console.log("release-check: OK");
