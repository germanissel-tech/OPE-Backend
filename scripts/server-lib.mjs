// Starting the built server as a child process for the scripts that drive it from outside
// (test:contract, test:load): free port, entry (dist/ or tsx), health wait and graceful stop.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { repoRoot } from "./lib.mjs";

// The server compiles the contract validators at startup: fifteen seconds covers a cold CI runner.
const STARTUP_TIMEOUT_MS = 15000;
// Time given to a graceful SIGTERM before SIGKILL.
const KILL_GRACE_MS = 3000;
const HEALTH_POLL_MS = 200;

/** @returns {Promise<number>} */
export function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      if (address === null || typeof address === "string") {
        reject(new Error("Could not get a free port"));
        return;
      }
      srv.close(() => {
        resolve(address.port);
      });
    });
    srv.on("error", reject);
  });
}

/**
 * Resolves once any HTTP response comes back from `url` (in a negative test it is not 200).
 * @param {string} url
 * @param {number} [timeoutMs]
 */
export async function waitForHealth(url, timeoutMs = STARTUP_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      // the server is not listening yet
    }
    await new Promise((r) => setTimeout(r, HEALTH_POLL_MS));
  }
  throw new Error(`The server did not respond at ${url} within ${timeoutMs} ms`);
}

/** @returns {{ cmd: string; args: string[] }} the built server, or tsx on an alternative entry */
function serverCommand() {
  const built = path.join(repoRoot, "dist", "main.js");
  // OPE_SERVER_ENTRY: an alternative process entry in TypeScript (the negative test); tsx runs it.
  const entry = process.env["OPE_SERVER_ENTRY"];
  if (entry === undefined && existsSync(built)) return { cmd: process.execPath, args: [built] };
  return {
    cmd: process.execPath,
    args: [
      path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs"),
      path.resolve(repoRoot, entry ?? path.join("src", "main.ts")),
    ],
  };
}

/** @typedef {{ base: string; log: () => string; stop: () => Promise<void> }} RunningServer */

/**
 * Starts the server on a free port with the given environment on top of the process one,
 * waits until it answers on /v1/health and returns how to reach it and how to stop it.
 * @param {Record<string, string>} env
 * @returns {Promise<RunningServer>}
 */
export async function startBuiltServer(env) {
  const port = await freePort();
  const { cmd, args } = serverCommand();
  const server = spawn(cmd, args, {
    cwd: repoRoot,
    env: { ...process.env, ...env, PORT: String(port), HOST: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  /** @param {Buffer | string} chunk */
  const append = (chunk) => {
    serverLog += chunk.toString();
  };
  server.stdout.on("data", append);
  server.stderr.on("data", append);
  /** @returns {Promise<void>} */
  const stop = () =>
    new Promise((resolve) => {
      if (server.exitCode !== null) {
        resolve();
        return;
      }
      server.once("exit", () => {
        resolve();
      });
      server.kill("SIGTERM");
      setTimeout(() => {
        if (server.exitCode === null) server.kill("SIGKILL");
      }, KILL_GRACE_MS).unref();
    });
  const base = `http://127.0.0.1:${port}`;
  try {
    await waitForHealth(`${base}/v1/health`);
  } catch (err) {
    await stop();
    throw new Error(`${err instanceof Error ? err.message : String(err)}\n${serverLog}`, { cause: err });
  }
  return { base, log: () => serverLog, stop };
}
