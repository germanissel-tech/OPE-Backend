// contract:diff — compara el contrato empaquetado con el de la rama principal y falla ante
// cambios incompatibles si la versión mayor no aumentó (FR-020).
//
//   node scripts/contract-diff.mjs                       # base: $CONTRACT_BASE_REF | origin/main | main
//   node scripts/contract-diff.mjs --base a.yaml --head b.yaml   # modo pruebas: dos archivos
//
// Salidas: "AVISO: sin contrato base, comparación omitida" (exit 0) cuando no hay base;
// "Cambio incompatible esperado: versión mayor X → Y" (exit 0) con bump de major;
// "Sin cambios incompatibles" (exit 0); o el reporte de oasdiff (exit 1).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "yaml";
import { bundlePath, capture, repoRoot, runCli } from "./lib.mjs";
import { resolveOasdiff } from "./oasdiff-install.mjs";

const SEVERITY_FILE = path.join(repoRoot, "contracts", "oasdiff-severity.txt");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--base") args.base = argv[++i];
    else if (argv[i] === "--head") args.head = argv[++i];
  }
  return args;
}

function majorOf(file) {
  const doc = parse(readFileSync(file, "utf8"));
  const version = String(doc?.info?.version ?? "");
  const major = Number(version.split(".")[0]);
  if (!Number.isInteger(major)) throw new Error(`info.version inválida en ${file}: '${version}'`);
  return { version, major };
}

/** Resuelve la referencia git base; null si no hay ninguna disponible. */
function resolveBaseRef() {
  const candidates = [process.env.CONTRACT_BASE_REF, "origin/main", "main"].filter(Boolean);
  for (const ref of candidates) {
    const { status } = capture("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    if (status === 0) return ref;
  }
  return null;
}

/** Copia contracts/ de la referencia base (sólo git, sin tar) y lo bundlea. Devuelve la ruta del bundle o null. */
function bundleBase(ref, workDir) {
  const { status: hasContract } = capture("git", ["cat-file", "-e", `${ref}:contracts/openapi.yaml`]);
  if (hasContract !== 0) return null;
  const listing = capture("git", ["ls-tree", "-r", "--name-only", ref, "contracts"]);
  if (listing.status !== 0) throw new Error(`git ls-tree falló: ${listing.stderr}`);
  const files = listing.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  for (const file of files) {
    const content = capture("git", ["show", `${ref}:${file}`], { encoding: "buffer" });
    if (content.status !== 0) throw new Error(`git show ${ref}:${file} falló`);
    const target = path.join(workDir, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content.stdout);
  }
  const baseRoot = path.join(workDir, "contracts", "openapi.yaml");
  const out = path.join(workDir, "base-bundle.yaml");
  const status = runCli(
    "redocly",
    ["bundle", baseRoot, "-o", out, "--config", path.join(repoRoot, "redocly.yaml")],
    { stdio: "pipe" },
  );
  if (status !== 0) throw new Error(`No se pudo bundlear el contrato base (${ref})`);
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let workDir = null;
  try {
    let base;
    let head;
    let baseLabel;
    if (args.base || args.head) {
      if (!args.base || !args.head) throw new Error("Usá --base <archivo> y --head <archivo> juntos");
      base = path.resolve(args.base);
      head = path.resolve(args.head);
      baseLabel = args.base;
      if (!existsSync(base)) base = null;
    } else {
      if (!existsSync(bundlePath))
        throw new Error(`No existe ${bundlePath}. Corré npm run contract:bundle primero.`);
      head = bundlePath;
      const ref = resolveBaseRef();
      baseLabel = ref ?? "(sin rama base)";
      if (ref) {
        workDir = mkdtempSync(path.join(os.tmpdir(), "ope-contract-base-"));
        base = bundleBase(ref, workDir);
      } else {
        base = null;
      }
    }

    if (!base) {
      console.log(`AVISO: sin contrato base en ${baseLabel}, comparación omitida`);
      return 0;
    }

    const oasdiff = await resolveOasdiff();
    const baseVersion = majorOf(base);
    const headVersion = majorOf(head);
    console.log(`contract:diff — base ${baseLabel} (${baseVersion.version}) → head (${headVersion.version})`);

    if (headVersion.major > baseVersion.major) {
      const changelog = capture(oasdiff, ["changelog", base, head, "--format", "text"]);
      process.stdout.write(changelog.stdout);
      console.log(`Cambio incompatible esperado: versión mayor ${baseVersion.major} → ${headVersion.major}`);
      return 0;
    }

    const result = capture(oasdiff, [
      "breaking",
      base,
      head,
      "--fail-on",
      "ERR",
      "--format",
      "text",
      "--severity-levels",
      SEVERITY_FILE,
    ]);
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    if (result.status !== 0) {
      console.error(
        `contract:diff — cambios incompatibles sin aumento de versión mayor (${headVersion.version}). Corregí el contrato o subí info.version a ${baseVersion.major + 1}.0.0 y el prefijo de rutas a /v${baseVersion.major + 1}/.`,
      );
      return result.status;
    }
    console.log("Sin cambios incompatibles");
    return 0;
  } finally {
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`contract:diff — ${err.message}`);
    process.exit(2);
  });
