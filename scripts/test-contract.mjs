// test:contract — pruebas de contrato generadas por Schemathesis contra el servidor levantado
// (FR-051, US5). Arranca el servidor en un puerto libre, espera a que responda, corre
// `uvx schemathesis` sobre el bundle y apaga el servidor propagando el código de salida.
//
// Prueba negativa manual: OPE_HANDLERS_MODULE=tests/contract/fixtures/health-203.ts npm run test:contract
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { bundlePath, repoRoot } from "./lib.mjs";

// Versión fijada: la misma en local y en CI.
const SCHEMATHESIS = "schemathesis@4.27.2";

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function waitForHealth(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      // Cualquier respuesta HTTP indica que el servidor escucha (en la prueba negativa no es 200).
      await fetch(url);
      return;
    } catch {
      // el servidor todavía no escucha
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`El servidor no respondió en ${url} dentro de ${timeoutMs} ms`);
}

function serverCommand() {
  const built = path.join(repoRoot, "dist", "main.js");
  if (existsSync(built) && !process.env.OPE_HANDLERS_MODULE) return [process.execPath, [built]];
  // tsx permite cargar manejadores alternativos en TypeScript (prueba negativa).
  return [
    process.execPath,
    [path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs"), path.join(repoRoot, "src", "main.ts")],
  ];
}

async function main() {
  const uvx = spawnSync("uvx", ["--version"], { encoding: "utf8" });
  if (uvx.status !== 0) {
    console.error("test:contract — no se encontró `uvx`. Instalá uv: https://docs.astral.sh/uv/");
    return 1;
  }
  if (!existsSync(bundlePath)) {
    console.error(`test:contract — no existe ${bundlePath}. Corré npm run contract:bundle.`);
    return 1;
  }

  const port = await freePort();
  const [cmd, args] = serverCommand();
  const server = spawn(cmd, args, {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  server.stdout.on("data", (d) => (serverLog += d));
  server.stderr.on("data", (d) => (serverLog += d));

  const stop = () =>
    new Promise((resolve) => {
      if (server.exitCode !== null) return resolve();
      server.once("exit", () => resolve());
      server.kill("SIGTERM");
      setTimeout(() => {
        if (server.exitCode === null) server.kill("SIGKILL");
      }, 3000).unref();
    });

  try {
    const base = `http://127.0.0.1:${port}`;
    await waitForHealth(`${base}/v1/health`, 15000);
    console.log(`test:contract — servidor en ${base}; corriendo Schemathesis…`);
    const st = spawnSync(
      "uvx",
      [
        SCHEMATHESIS,
        "run",
        bundlePath,
        "--url",
        base,
        "--checks",
        "all",
        "--phases",
        "examples,coverage,fuzzing",
        "--max-examples",
        "50",
        "--report",
        "junit",
        "--report-dir",
        path.join(repoRoot, ".schemathesis"),
      ],
      {
        stdio: "inherit",
        cwd: repoRoot,
        // Salida UTF-8 también en consolas Windows (cp1252).
        env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      },
    );
    return st.status ?? 1;
  } catch (err) {
    console.error(`test:contract — ${err.message}`);
    console.error(serverLog);
    return 1;
  } finally {
    await stop();
  }
}

main().then((code) => process.exit(code));
