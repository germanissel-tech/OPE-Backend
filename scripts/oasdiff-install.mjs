// Downloads the oasdiff binary (Go), pinned by version and verified by SHA-256, into
// node_modules/.cache/oasdiff/. Does not run on postinstall: it is invoked the first time it is
// needed (contract:diff). No dependencies outside Node.
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
import { repoRoot } from "./lib.mjs";

export const OASDIFF_VERSION = "1.32.1";
const RELEASE_BASE = `https://github.com/oasdiff/oasdiff/releases/download/v${OASDIFF_VERSION}`;

/** @type {Record<string, string | undefined>} */
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

/**
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
async function download(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Could not download ${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Extracts a single file from a tar (already decompressed). ustar format, no dependencies.
 * @param {Buffer} tar
 * @param {string} wanted
 * @returns {Buffer}
 */
function extractFromTar(tar, wanted) {
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/s, "");
    const size = parseInt(header.subarray(124, 136).toString("utf8").replace(/\0.*$/s, "").trim(), 8);
    const typeflag = String.fromCharCode(header[156] ?? 0);
    const dataStart = offset + 512;
    if ((typeflag === "0" || typeflag === "\0") && path.posix.basename(name) === wanted) {
      return tar.subarray(dataStart, dataStart + size);
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  throw new Error(`File ${wanted} is not in the oasdiff tarball`);
}

/** @returns {Promise<string>} */
export async function ensureOasdiff() {
  if (existsSync(oasdiffPath)) return oasdiffPath;
  const key = `${process.platform}-${process.arch}`;
  const asset = ASSETS[key];
  if (!asset)
    throw new Error(
      `oasdiff: platform without an official binary: ${key}. Install oasdiff by hand and export OASDIFF_BIN.`,
    );
  const fileName = `oasdiff_${OASDIFF_VERSION}_${asset}.tar.gz`;
  console.log(`oasdiff ${OASDIFF_VERSION} is not cached; downloading ${fileName}…`);
  const [archive, checksums] = await Promise.all([
    download(`${RELEASE_BASE}/${fileName}`),
    download(`${RELEASE_BASE}/checksums.txt`),
  ]);
  const expected = checksums
    .toString("utf8")
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .find(([, name]) => name === fileName)?.[0];
  if (!expected) throw new Error(`oasdiff: ${fileName} is not listed in checksums.txt`);
  const actual = createHash("sha256").update(archive).digest("hex");
  if (actual !== expected)
    throw new Error(`oasdiff: invalid checksum for ${fileName} (expected ${expected}, got ${actual})`);
  const binary = extractFromTar(gunzipSync(archive), exeName);
  mkdirSync(cacheDir, { recursive: true });
  const tmp = `${oasdiffPath}.tmp`;
  writeFileSync(tmp, binary);
  chmodSync(tmp, 0o755);
  renameSync(tmp, oasdiffPath);
  console.log(`oasdiff installed at ${oasdiffPath}`);
  return oasdiffPath;
}

/**
 * Binary path: OASDIFF_BIN if defined, otherwise the cached one (downloading it if missing).
 * @returns {Promise<string>}
 */
export async function resolveOasdiff() {
  const override = process.env["OASDIFF_BIN"];
  if (override) return override;
  return ensureOasdiff();
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  resolveOasdiff()
    .then((p) => {
      console.log(p);
    })
    .catch((/** @type {unknown} */ e) => {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    });
}
