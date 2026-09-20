#!/usr/bin/env node
// Mints the token of an operator of OPE (ADR-031): prints the token once — hand it over out of
// band — and the entry for OPE_ADMIN_OPERATORS, which carries only its fingerprint.
//   node scripts/mint-admin-token.mjs <operatorId> [scope]   # scope: "*" (default) or m1,m2
import { createHash, randomBytes } from "node:crypto";

const [operatorId, scope] = process.argv.slice(2);
if (operatorId === undefined || operatorId === "") {
  console.error('usage: node scripts/mint-admin-token.mjs <operatorId> ["*" | merchantId,merchantId]');
  process.exit(2);
}
const TOKEN_BYTES = 32;
const token = `ope_at_${randomBytes(TOKEN_BYTES).toString("base64url")}`;
const fingerprint = createHash("sha256").update(token, "utf8").digest("hex");
const entry = {
  operatorId,
  tokenFingerprints: [fingerprint],
  scope: scope === undefined || scope === "*" ? "*" : scope.split(",").map((m) => m.trim()),
};
console.log(`Token (shown once; give it to the operator out of band):\n${token}\n`);
console.log(`Entry for OPE_ADMIN_OPERATORS (append to the array):\n${JSON.stringify(entry, null, 2)}`);
