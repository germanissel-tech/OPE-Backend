// Descarga el binario de oasdiff (Go) fijado por versión y verificado por SHA-256, en
// node_modules/.cache/oasdiff/. No corre en postinstall: se invoca la primera vez que hace
// falta (contract:diff). Sin dependencias fuera de Node.
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
import { repoRoot } from "./lib.mjs";

export const OASDIFF_VERSION = "1.32.1";
const RELEASE_BASE = `https://github.com/oasdiff/oasdiff/releases/download/v${OASDIFF_VERSION}`;

const ASSETS = {
  "linux-x64": "linux_amd64",
  "linux-arm64": "linux_arm64",
  "darwin-x64": "darwin_all",
  "darwin-arm64": "darwin_all",
  "win32-x64": "windows_amd64",
  "win32-arm64": "windows_arm64",
};

const cacheDir = path.join(repoRoot, "node_modules", ".cache", "oasdiff", OASDIFF_VERSION);
const exeName = process.platform === "win32" ? "oasdiff.exe" : "oasdiff";
export const oasdiffPath = path.join(cacheDir, exeName);

async function download(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`No se pudo descargar ${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Extrae un único archivo de un tar (ya descomprimido). Formato ustar, sin dependencias. */
function extractFromTar(tar, wanted) {
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/s, "");
    const size = parseInt(header.subarray(124, 136).toString("utf8").replace(/\0.*$/s, "").trim(), 8);
    const typeflag = String.fromCharCode(header[156]);
    const dataStart = offset + 512;
    if ((typeflag === "0" || typeflag === "\0") && path.posix.basename(name) === wanted) {
      return tar.subarray(dataStart, dataStart + size);
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  throw new Error(`El archivo ${wanted} no está en el tarball de oasdiff`);
}

export async function ensureOasdiff() {
  if (existsSync(oasdiffPath)) return oasdiffPath;
  const key = `${process.platform}-${process.arch}`;
  const asset = ASSETS[key];
  if (!asset) throw new Error(`oasdiff: plataforma sin binario oficial: ${key}. Instalá oasdiff a mano y exportá OASDIFF_BIN.`);
  const fileName = `oasdiff_${OASDIFF_VERSION}_${asset}.tar.gz`;
  console.log(`oasdiff ${OASDIFF_VERSION} no está en caché; descargando ${fileName}…`);
  const [archive, checksums] = await Promise.all([download(`${RELEASE_BASE}/${fileName}`), download(`${RELEASE_BASE}/checksums.txt`)]);
  const expected = checksums
    .toString("utf8")
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .find(([, name]) => name === fileName)?.[0];
  if (!expected) throw new Error(`oasdiff: ${fileName} no figura en checksums.txt`);
  const actual = createHash("sha256").update(archive).digest("hex");
  if (actual !== expected) throw new Error(`oasdiff: checksum inválido para ${fileName} (esperado ${expected}, obtenido ${actual})`);
  const binary = extractFromTar(gunzipSync(archive), exeName);
  mkdirSync(cacheDir, { recursive: true });
  const tmp = `${oasdiffPath}.tmp`;
  writeFileSync(tmp, binary);
  chmodSync(tmp, 0o755);
  renameSync(tmp, oasdiffPath);
  console.log(`oasdiff instalado en ${oasdiffPath}`);
  return oasdiffPath;
}

/** Ruta del binario: OASDIFF_BIN si está definido, si no el de caché (descargándolo si falta). */
export async function resolveOasdiff() {
  if (process.env.OASDIFF_BIN) return process.env.OASDIFF_BIN;
  return ensureOasdiff();
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  resolveOasdiff()
    .then((p) => console.log(p))
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
