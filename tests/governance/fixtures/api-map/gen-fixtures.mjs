// Generates one fixture directory per case of check-api-map.mjs (FR-003; ADR-019). Each case
// starts from a valid map + bundle and applies one mutation. Run: node tests/governance/fixtures/api-map/gen-fixtures.mjs
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";

const here = path.dirname(fileURLToPath(import.meta.url));

/** @typedef {Record<string, any>} Doc */

/** @returns {Doc} */
const validMap = () => ({
  consumers: {
    public: { securityScheme: null, tags: ["system"], capabilities: [] },
    sdk: { securityScheme: "ingestKey", tags: ["ingest"], capabilities: ["events:write"] },
    portal: { securityScheme: "portalSession", tags: ["portal"], capabilities: ["ledger:read"] },
    admin: { securityScheme: "adminToken", tags: ["admin"], capabilities: ["flags:write"] },
  },
  features: { "010": "Configuration" },
  operations: [
    op("getHealth", "get", "/v1/health", "public", "system", [], "001", "built", "constitucion#I"),
    op("ingestEvents", "post", "/v1/events", "sdk", "ingest", ["events:write"], "004", "built", "mvp:01-x.md#Intro"),
    op("listOldThings", "get", "/v1/old-things", "sdk", "ingest", ["events:write"], "004", "deprecated", "constitucion#I"),
    { ...op("listGone", "get", "/v1/gone", "sdk", "ingest", ["events:write"], "001", "retired", "constitucion#I"), retiredIn: "1.0.0" },
    op("putFlags", "put", "/v1/admin/merchants/{merchantId}/flags", "admin", "admin", ["flags:write"], "010", "planned", "constitucion#I"),
  ],
});

/**
 * @param {string} operationId @param {string} method @param {string} p @param {string} consumer
 * @param {string} tag @param {string[]} capabilities @param {string} feature @param {string} status @param {string} source
 * @returns {Doc}
 */
function op(operationId, method, p, consumer, tag, capabilities, feature, status, source) {
  return { operationId, method, path: p, consumer, tag, capabilities, feature, status, source };
}

/** @returns {Doc} */
const validBundle = () => ({
  openapi: "3.1.0",
  info: { title: "f", version: "1.0.0" },
  paths: {
    "/v1/health": { get: { operationId: "getHealth", tags: ["system"], security: [], responses: { 200: { description: "ok" } } } },
    "/v1/events": {
      post: {
        operationId: "ingestEvents",
        tags: ["ingest"],
        security: [{ ingestKey: [] }],
        "x-required-capabilities": ["events:write"],
        responses: { 202: { description: "ok" } },
      },
    },
    "/v1/old-things": {
      get: {
        operationId: "listOldThings",
        tags: ["ingest"],
        deprecated: true,
        security: [{ ingestKey: [] }],
        "x-required-capabilities": ["events:write"],
        responses: { 200: { description: "ok" } },
      },
    },
  },
  components: { securitySchemes: { ingestKey: { type: "apiKey", in: "header", name: "X-OPE-Ingest-Key" } } },
});

const SCHEMES = {
  "ingestKey.yaml": "type: apiKey\nin: header\nname: X-OPE-Ingest-Key\ndescription: Public key of the merchant.\n",
  "portalSession.yaml": "type: http\nscheme: bearer\ndescription: PROPOSED — session token.\n",
  "adminToken.yaml": "type: http\nscheme: bearer\ndescription: PROPOSED — operator token.\n",
};

/** @type {Record<string, (map: Doc, bundle: Doc, dir: string) => void>} */
const cases = {
  ok: () => undefined,
  "contract-without-entry": (_m, b) => {
    b.paths["/v1/things"] = { get: { operationId: "listThings", tags: ["ingest"], security: [{ ingestKey: [] }], "x-required-capabilities": ["events:write"], responses: { 200: { description: "ok" } } } };
  },
  "built-without-operation": (m) => {
    m.operations.push(op("listThings", "get", "/v1/things", "sdk", "ingest", ["events:write"], "004", "built", "constitucion#I"));
  },
  "built-field-mismatch": (m) => {
    m.operations[1].tag = "system";
    m.operations[1].consumer = "public";
    m.operations[1].capabilities = [];
  },
  "built-security-mismatch": (_m, b) => {
    b.paths["/v1/events"].post.security = [{ portalSession: [] }];
  },
  "built-capability-mismatch": (_m, b) => {
    b.paths["/v1/events"].post["x-required-capabilities"] = ["ledger:read"];
  },
  "tag-outside-consumer": (m) => {
    m.operations[4].tag = "portal";
  },
  "capability-outside-vocabulary": (m) => {
    m.operations[4].capabilities = ["events:write"];
  },
  "scheme-file-missing": (m) => {
    m.consumers.portal.securityScheme = "nowhere";
  },
  "scheme-file-malformed": (_m, _b, dir) => {
    writeFileSync(path.join(dir, "securitySchemes", "adminToken.yaml"), "description: no type here\n");
  },
  "feature-unknown": (m) => {
    m.operations[4].feature = "099";
  },
  "source-broken": (m) => {
    m.operations[4].source = "constitucion#Nowhere";
  },
  "duplicate-operation-id": (m) => {
    m.operations.push(op("putFlags", "put", "/v1/admin/merchants/{merchantId}/other", "admin", "admin", ["flags:write"], "010", "planned", "constitucion#I"));
  },
  "duplicate-method-path": (m) => {
    m.operations.push(op("putFlagsAgain", "put", "/v1/admin/merchants/{merchantId}/flags", "admin", "admin", ["flags:write"], "010", "planned", "constitucion#I"));
  },
  "status-unknown": (m) => {
    m.operations[4].status = "someday";
  },
  "deprecated-without-flag": (_m, b) => {
    delete b.paths["/v1/old-things"].get.deprecated;
  },
  "flag-without-deprecated": (m) => {
    m.operations[2].status = "built";
  },
  "retired-present": (_m, b) => {
    b.paths["/v1/gone"] = { get: { operationId: "listGone", tags: ["ingest"], security: [{ ingestKey: [] }], "x-required-capabilities": ["events:write"], responses: { 200: { description: "ok" } } } };
  },
  "retired-without-version": (m) => {
    delete m.operations[3].retiredIn;
  },
  "merchant-id-outside-admin": (m) => {
    m.operations.push(op("listDecisions", "get", "/v1/portal/{merchantId}/decisions", "portal", "portal", ["ledger:read"], "010", "planned", "constitucion#I"));
  },
  "public-with-security": (_m, b) => {
    b.paths["/v1/health"].get.security = [{ ingestKey: [] }];
  },
  "mvp-absent": () => undefined,
};

for (const [name, mutate] of Object.entries(cases)) {
  const dir = path.join(here, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(path.join(dir, "securitySchemes"), { recursive: true });
  mkdirSync(path.join(dir, "specs", "004-ingest"), { recursive: true });
  mkdirSync(path.join(dir, "specs", "001-toolchain"), { recursive: true });
  for (const [file, content] of Object.entries(SCHEMES)) writeFileSync(path.join(dir, "securitySchemes", file), content);
  writeFileSync(path.join(dir, "constitucion.md"), "# Test constitution\n\n## I · First principle\n\nx\n");
  if (name !== "mvp-absent") {
    mkdirSync(path.join(dir, "mvp"), { recursive: true });
    writeFileSync(path.join(dir, "mvp", "01-x.md"), "# Doc\n\n## Intro\n\nx\n");
  }
  const map = validMap();
  const bundle = validBundle();
  mutate(map, bundle, dir);
  writeFileSync(path.join(dir, "api-map.yaml"), stringify(map));
  writeFileSync(path.join(dir, "bundle.yaml"), stringify(bundle));
}
console.log(`${Object.keys(cases).length} api-map fixtures in ${here}`);
