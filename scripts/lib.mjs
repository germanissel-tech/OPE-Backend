// Utilidades compartidas por los scripts del contrato. Sin dependencias de shell: corren
// igual en Windows, macOS y Linux.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const contractRoot = process.env.OPE_CONTRACT_ROOT ?? path.join(repoRoot, "contracts", "openapi.yaml");
export const bundlePath = path.join(repoRoot, "contracts", "dist", "openapi.yaml");
export const generatedTypesPath =
  process.env.OPE_TYPES_FILE ?? path.join(repoRoot, "src", "generated", "api.d.ts");

/**
 * Comando + argumentos para invocar la CLI de un paquete instalado, sin pasar por los
 * wrappers .cmd de node_modules/.bin (fallan en Windows con espacios en la ruta).
 */
const CLI_ENTRIES = {
  redocly: "@redocly/cli/bin/cli.js",
  spectral: "@stoplight/spectral-cli/dist/index.js",
};
export function cli(name) {
  const entry = CLI_ENTRIES[name];
  if (!entry) throw new Error(`CLI desconocida: ${name}`);
  return { cmd: process.execPath, prefix: [path.join(repoRoot, "node_modules", entry)] };
}

/** Ejecuta un comando heredando stdio y devuelve el código de salida. */
export function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: repoRoot, ...options });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

/** Ejecuta la CLI de un paquete (ver `cli`). */
export function runCli(name, args, options = {}) {
  const { cmd, prefix } = cli(name);
  return run(cmd, [...prefix, ...args], options);
}

/** Ejecuta un comando capturando stdout/stderr. */
export function capture(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", cwd: repoRoot, ...options });
  if (result.error) throw result.error;
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}
