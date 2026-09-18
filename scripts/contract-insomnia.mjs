// contract:insomnia — an Insomnia collection (export format 4) derived from the bundled contract:
// one request per operation, its first request example as the body, the credential header of
// its security scheme as an environment variable, and every date-time of the example replaced
// by Insomnia's `now` template so the invariants on instants hold when the request is sent.
// Derived artefact (docs/api/insomnia.json, not committed): the contract stays the single source.
//
//   npm run contract:insomnia            # writes docs/api/insomnia.json
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isRecord, prop, readYaml } from "./governance-lib.mjs";
import { bundlePath, repoRoot } from "./lib.mjs";

const OUTPUT = path.join(repoRoot, "docs", "api", "insomnia.json");
const HTTP_METHODS = ["get", "put", "post", "delete", "patch"];
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const NOW_TEMPLATE = "{% now 'iso-8601', '' %}";
const BASE_URL = "http://127.0.0.1:3000";

/** The environment variable that carries each security scheme's credential, with the dev value. */
const CREDENTIALS = {
  ingestKey: { variable: "ingest_key", value: "ope_dev_ingest_key" },
  platformKey: { variable: "platform_key", value: "ope_dev_platform_key" },
};

/**
 * Resolves `#/...` references inside the bundled document; anything else comes back as is.
 * @param {unknown} node
 * @param {unknown} doc
 * @returns {unknown}
 */
function resolve(node, doc) {
  const ref = prop(node, "$ref");
  if (typeof ref !== "string" || !ref.startsWith("#/")) return node;
  return ref
    .slice(2)
    .split("/")
    .reduce((current, key) => prop(current, key), doc);
}

/**
 * The example value with every date-time string replaced by the `now` template.
 * @param {unknown} value
 * @returns {unknown}
 */
function withLiveInstants(value) {
  if (typeof value === "string") return ISO_DATE_TIME.test(value) ? NOW_TEMPLATE : value;
  if (Array.isArray(value)) return value.map(withLiveInstants);
  if (isRecord(value))
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withLiveInstants(v)]));
  return value;
}

/**
 * The first JSON request example of an operation, or undefined.
 * @param {unknown} operation
 * @param {unknown} doc
 * @returns {unknown}
 */
function requestExample(operation, doc) {
  const media = prop(prop(prop(operation, "requestBody"), "content"), "application/json");
  const examples = prop(media, "examples");
  const first = isRecord(examples) ? Object.values(examples)[0] : undefined;
  const example = first === undefined ? prop(media, "example") : prop(resolve(first, doc), "value");
  return example;
}

/**
 * The credential header an operation's security scheme uses, or undefined for a public one.
 * @param {unknown} operation
 * @param {unknown} doc
 * @returns {{ name: string; value: string } | undefined}
 */
function credentialHeader(operation, doc) {
  const security = prop(operation, "security");
  const requirement = Array.isArray(security) ? security[0] : undefined;
  const scheme = isRecord(requirement) ? Object.keys(requirement)[0] : undefined;
  if (scheme === undefined) return undefined;
  const declared = prop(prop(prop(doc, "components"), "securitySchemes"), scheme);
  const name = prop(declared, "name");
  const credential = /** @type {Record<string, { variable: string }>} */ (CREDENTIALS)[scheme];
  if (typeof name !== "string" || credential === undefined) return undefined;
  return { name, value: `{{ _.${credential.variable} }}` };
}

/**
 * One Insomnia request for an operation: credential header, JSON example as body.
 * @param {string} method
 * @param {string} route
 * @param {Record<string, unknown>} operation
 * @param {unknown} doc
 * @returns {Record<string, unknown>}
 */
function requestOf(method, route, operation, doc) {
  const operationId = String(operation["operationId"] ?? `${method} ${route}`);
  const headers = [];
  const credential = credentialHeader(operation, doc);
  if (credential) headers.push(credential);
  const example = requestExample(operation, doc);
  const body =
    example === undefined
      ? {}
      : { mimeType: "application/json", text: JSON.stringify(withLiveInstants(example), null, 2) };
  if (example !== undefined) headers.push({ name: "Content-Type", value: "application/json" });
  return {
    _id: `req_${operationId}`,
    _type: "request",
    name: `${method.toUpperCase()} ${route} — ${operationId}`,
    description: String(operation["summary"] ?? ""),
    method: method.toUpperCase(),
    url: `{{ _.base_url }}${route}`,
    headers,
    body,
  };
}

/**
 * @param {unknown} doc
 * @param {string} workspaceId
 * @returns {Record<string, unknown>[]}
 */
function requestsOf(doc, workspaceId) {
  /** @type {Record<string, unknown>[]} */
  const out = [];
  const paths = prop(doc, "paths");
  for (const [route, item] of Object.entries(isRecord(paths) ? paths : {})) {
    for (const method of HTTP_METHODS) {
      const operation = prop(item, method);
      if (!isRecord(operation)) continue;
      out.push({
        ...requestOf(method, route, operation, doc),
        parentId: workspaceId,
        metaSortKey: out.length,
      });
    }
  }
  return out;
}

/** @returns {number} */
function main() {
  if (!existsSync(bundlePath)) {
    console.error(`contract:insomnia — ${bundlePath} does not exist. Run npm run contract:bundle first.`);
    return 1;
  }
  const doc = readYaml(bundlePath);
  const title = String(prop(prop(doc, "info"), "title") ?? "OPE Backend API");
  const version = String(prop(prop(doc, "info"), "version") ?? "");
  const workspaceId = "wrk_ope_backend";
  const environment = Object.fromEntries([
    ["base_url", BASE_URL],
    ...Object.values(CREDENTIALS).map(({ variable, value }) => [variable, value]),
  ]);
  const collection = {
    _type: "export",
    __export_format: 4,
    __export_date: "2026-01-01T00:00:00.000Z",
    __export_source: "ope-backend:contract-insomnia",
    resources: [
      {
        _id: workspaceId,
        _type: "workspace",
        parentId: null,
        name: `${title} ${version}`,
        scope: "collection",
      },
      {
        _id: "env_ope_backend",
        _type: "environment",
        parentId: workspaceId,
        name: "Local (npm run dev)",
        data: environment,
      },
      ...requestsOf(doc, workspaceId),
    ],
  };
  mkdirSync(path.dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(collection, null, 2)}\n`);
  console.log(
    `contract:insomnia — ${path.relative(repoRoot, OUTPUT)} with ${collection.resources.length - 2} requests`,
  );
  return 0;
}

process.exit(main());
