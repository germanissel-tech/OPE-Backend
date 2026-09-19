#!/usr/bin/env node
// Prints the platform signature headers (ADR-029) for a JSON file, to paste into curl or
// Insomnia: node scripts/sign-platform-request.mjs <secret> <file.json> [unix-seconds].
// The file is signed byte for byte: send exactly that file as the body.
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const [secret, file, at] = process.argv.slice(2);
if (secret === undefined || file === undefined) {
  console.error("usage: node scripts/sign-platform-request.mjs <secret> <file.json> [unix-seconds]");
  process.exit(2);
}
const timestamp = at ?? String(Math.floor(Date.now() / 1000));
const body = readFileSync(file);
const digest = createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex");
console.log(`X-OPE-Timestamp: ${timestamp}`);
console.log(`X-OPE-Signature: v1=${digest}`);
