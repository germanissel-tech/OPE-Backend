// contract:docs — documentación estática autocontenida desde el bundle (FR-032).
// Se rehúsa si la verificación completa del contrato falla: nunca se publica documentación
// de un contrato inválido.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bundlePath, repoRoot, run, runCli } from "./lib.mjs";

// npm_execpath está definido cuando este script corre vía `npm run`; si no, se usa `npm` del PATH.
const npmCli = process.env.npm_execpath;
const check = npmCli
  ? run(process.execPath, [npmCli, "run", "contract:check"])
  : run("npm", ["run", "contract:check"], { shell: true });
if (check !== 0) {
  console.error("contract:docs — la verificación del contrato falló; no se genera documentación.");
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

// Redocly enlaza Redoc desde su CDN. Para que el artefacto sea autocontenido (US4) se inlinea
// el bundle de la misma versión desde el paquete `redoc` (devDependency fijada).
const html = readFileSync(out, "utf8");
const cdnScript = /<script src="https:\/\/cdn\.redocly\.com\/redoc\/v([^/]+)\/bundles\/redoc\.standalone\.js"[^>]*><\/script>/;
const match = html.match(cdnScript);
if (!match) {
  console.error("contract:docs — no se encontró el <script> de Redoc en el HTML generado; revisar la versión de @redocly/cli.");
  process.exit(1);
}
const redocPkg = JSON.parse(readFileSync(path.join(repoRoot, "node_modules", "redoc", "package.json"), "utf8"));
if (redocPkg.version !== match[1]) {
  console.error(`contract:docs — @redocly/cli espera Redoc ${match[1]} pero el paquete redoc instalado es ${redocPkg.version}. Alineá la devDependency.`);
  process.exit(1);
}
const bundle = readFileSync(path.join(repoRoot, "node_modules", "redoc", "bundles", "redoc.standalone.js"), "utf8");
writeFileSync(out, html.replace(cdnScript, () => `<script>${bundle}</script>`), "utf8");
console.log(`Documentación autocontenida generada en ${out}`);
