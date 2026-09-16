// Runs a script from scripts/ as a child process and returns exit code + combined output.
import { spawnSync } from "node:child_process";
import path from "node:path";

export interface Outcome {
  status: number;
  output: string;
}

export function runScript(script: string, args: string[], env: Record<string, string> = {}): Outcome {
  const r = spawnSync(process.execPath, [path.resolve("scripts", script), ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: r.status ?? 1, output: `${r.stdout}${r.stderr}` };
}

export const fixture = (...parts: string[]): string => path.resolve("tests/governance/fixtures", ...parts);
