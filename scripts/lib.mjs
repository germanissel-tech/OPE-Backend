// Utilidades compartidas por los scripts del contrato. Sin dependencias de shell: corren
// igual en Windows, macOS y Linux. Tipos en JSDoc, verificados por tsconfig.scripts.json.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** @import { SpawnSyncOptions } from "node:child_process" */

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const contractRoot =
  process.env["OPE_CONTRACT_ROOT"] ?? path.join(repoRoot, "contracts", "openapi.yaml");
export const bundlePath = path.join(repoRoot, "contracts", "dist", "openapi.yaml");
export const generatedTypesPath =
  process.env["OPE_TYPES_FILE"] ??
  path.join(repoRoot, "src", "interface-adapters", "http", "generated", "api.d.ts");

/**
 * Comando + argumentos para invocar la CLI de un paquete instalado, sin pasar por los
 * wrappers .cmd de node_modules/.bin (fallan en Windows con espacios en la ruta).
 */
const CLI_ENTRIES = /** @type {const} */ ({
  redocly: "@redocly/cli/bin/cli.js",
  spectral: "@stoplight/spectral-cli/dist/index.js",
});

/** @typedef {keyof typeof CLI_ENTRIES} CliName */

/**
 * @param {CliName} name
 * @returns {{ cmd: string; prefix: string[] }}
 */
export function cli(name) {
  const entry = CLI_ENTRIES[name];
  return { cmd: process.execPath, prefix: [path.join(repoRoot, "node_modules", entry)] };
}

/**
 * Ejecuta un comando heredando stdio y devuelve el código de salida.
 * @param {string} cmd
 * @param {string[]} args
 * @param {SpawnSyncOptions} [options]
 * @returns {number}
 */
export function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: repoRoot, ...options });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

/**
 * Ejecuta la CLI de un paquete (ver `cli`).
 * @param {CliName} name
 * @param {string[]} args
 * @param {SpawnSyncOptions} [options]
 * @returns {number}
 */
export function runCli(name, args, options = {}) {
  const { cmd, prefix } = cli(name);
  return run(cmd, [...prefix, ...args], options);
}

/** @typedef {{ status: number; stdout: string; stderr: string }} Captured */

/**
 * Ejecuta un comando capturando stdout/stderr como texto UTF-8.
 * @param {string} cmd
 * @param {string[]} args
 * @param {SpawnSyncOptions} [options]
 * @returns {Captured}
 */
export function capture(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { cwd: repoRoot, ...options, encoding: "utf8" });
  if (result.error) throw result.error;
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}

/**
 * Ejecuta un comando capturando stdout como bytes (para contenido binario o con codificación
 * desconocida, como `git show`).
 * @param {string} cmd
 * @param {string[]} args
 * @returns {{ status: number; stdout: Buffer }}
 */
export function captureBuffer(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: repoRoot });
  if (result.error) throw result.error;
  return { status: result.status ?? 1, stdout: result.stdout };
}
