// check:api-map — the contract map against the contract (FR-003, FR-004, FR-040; ADR-019).
//
//   node scripts/check-api-map.mjs [--map f] [--bundle f] [--constitution f] [--mvp-docs d] [--specs d] [--schemes d]
//
// 1. Shape of the map: consumers (scheme file, tags, capabilities), features, operations.
// 2. Both directions: every operation of the bundle has an entry; every built/deprecated entry
//    has its operation, with the same method, path, tag, security and capabilities; planned
//    and retired entries are absent from the bundle.
// 3. Consistency: tag within the consumer, capabilities within the consumer's vocabulary,
//    `{merchantId}` in the path only under admin (constitution V, ADR-020), public ⇒ no
//    security and no capabilities, feature known, source verifiable, no duplicates, lifecycle
//    flags coherent (deprecated ⇔ `deprecated: true`; retired ⇒ `retiredIn`).
import { readdirSync } from "node:fs";
import path from "node:path";
import {
  argString,
  exists,
  isRecord,
  parseArgs,
  prop,
  readYaml,
  report,
  verifySource,
  HTTP_METHODS_LOWER,
} from "./governance-lib.mjs";
import { bundlePath, repoRoot } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const mapFile = path.resolve(argString(args, "map") ?? path.join(repoRoot, "contracts", "api-map.yaml"));
const bundle = path.resolve(argString(args, "bundle") ?? bundlePath);
const constitution = path.resolve(
  argString(args, "constitution") ?? path.join(repoRoot, ".specify", "memory", "constitution.md"),
);
const mvpDocs = path.resolve(
  argString(args, "mvp-docs") ?? process.env["OPE_MVP_DOCS"] ?? path.join(repoRoot, ".."),
);
const specsDir = path.resolve(argString(args, "specs") ?? path.join(repoRoot, "specs"));
const schemesDir = path.resolve(
  argString(args, "schemes") ?? path.join(repoRoot, "contracts", "components", "securitySchemes"),
);

const STATUSES = ["planned", "built", "deprecated", "retired"];
const IN_CONTRACT = ["built", "deprecated"];
const CAPABILITY = /^[a-z][a-z-]*:[a-z][a-z-]*$/;
const FEATURE = /^\d{3}$/;

/** @type {string[]} */
const problems = [];
/** @type {string[]} */
const warnings = [];

// --- Load ------------------------------------------------------------------------------
/** @type {unknown} */
let map = null;
if (!exists(mapFile)) problems.push(`the map ${mapFile} does not exist`);
else map = readYaml(mapFile);
/** @type {unknown} */
let doc = null;
if (!exists(bundle)) problems.push(`the bundle ${bundle} does not exist; run npm run contract:bundle`);
else doc = readYaml(bundle);

// --- Consumers -------------------------------------------------------------------------
/** @typedef {{ scheme: string | null; tags: string[]; capabilities: string[] }} Consumer */
/** @type {Map<string, Consumer>} */
const consumers = new Map();
/** @type {Map<string, string>} tag → consumer */
const consumerOfTag = new Map();

/**
 * @param {unknown} value
 * @param {string} where
 * @returns {string[]}
 */
function stringList(value, where) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    problems.push(`${where}: must be a list of strings`);
    return [];
  }
  return value;
}

/**
 * Minimal shape of a security scheme file: type, in+name for apiKey, scheme for http, description.
 * @param {string} name
 * @param {string} where
 */
function checkSchemeFile(name, where) {
  const file = path.join(schemesDir, `${name}.yaml`);
  if (!exists(file)) {
    problems.push(`${where}: security scheme "${name}" has no file ${file}`);
    return;
  }
  const scheme = readYaml(file);
  const type = prop(scheme, "type");
  const description = prop(scheme, "description");
  const ok =
    (type === "apiKey" &&
      typeof prop(scheme, "in") === "string" &&
      typeof prop(scheme, "name") === "string") ||
    (type === "http" && typeof prop(scheme, "scheme") === "string");
  if (!ok || typeof description !== "string" || description.trim() === "") {
    problems.push(
      `${where}: security scheme "${name}" is malformed (needs type apiKey with in+name, or http with scheme, and a description)`,
    );
  }
}

const consumersRaw = prop(map, "consumers");
if (map !== null && !isRecord(consumersRaw)) problems.push("the map has no `consumers` section");
for (const [name, raw] of Object.entries(isRecord(consumersRaw) ? consumersRaw : {})) {
  const where = `consumers.${name}`;
  if (!isRecord(raw)) {
    problems.push(`${where}: must be an object`);
    continue;
  }
  const schemeRaw = raw["securityScheme"];
  const scheme = schemeRaw === null || schemeRaw === undefined ? null : String(schemeRaw);
  if (name === "public" && scheme !== null) problems.push(`${where}: public must have securityScheme null`);
  if (name !== "public" && scheme === null) problems.push(`${where}: needs a securityScheme`);
  if (scheme !== null) checkSchemeFile(scheme, where);
  const tags = stringList(raw["tags"], `${where}.tags`);
  const capabilities = stringList(raw["capabilities"], `${where}.capabilities`);
  for (const c of capabilities) {
    if (!CAPABILITY.test(c)) problems.push(`${where}: capability "${c}" is not resource:action`);
  }
  for (const tag of tags) {
    const owner = consumerOfTag.get(tag);
    if (owner !== undefined) problems.push(`${where}: tag "${tag}" already belongs to consumer ${owner}`);
    consumerOfTag.set(tag, name);
  }
  consumers.set(name, { scheme, tags, capabilities });
}

// --- Features ---------------------------------------------------------------------------
const featuresRaw = prop(map, "features");
/** @type {Set<string>} */
const roadmap = new Set(Object.keys(isRecord(featuresRaw) ? featuresRaw : {}));
/** @type {Set<string>} */
const specFeatures = new Set(
  exists(specsDir)
    ? readdirSync(specsDir)
        .map((d) => /^(\d{3})-/.exec(d)?.[1])
        .filter((n) => n !== undefined)
    : [],
);

// --- Contract operations ----------------------------------------------------------------
/** @typedef {{ method: string; path: string; tags: string[]; security: unknown; capabilities: string[]; deprecated: boolean }} ContractOp */
/** @type {Map<string, ContractOp>} */
const contractOps = new Map();
const paths = prop(doc, "paths");
for (const [route, item] of Object.entries(isRecord(paths) ? paths : {})) {
  if (!isRecord(item)) continue;
  for (const method of HTTP_METHODS_LOWER) {
    const operation = item[method];
    if (!isRecord(operation)) continue;
    const id = operation["operationId"];
    if (typeof id !== "string") continue;
    contractOps.set(id, {
      method,
      path: route,
      tags: stringList(operation["tags"], `${id}.tags`),
      security: operation["security"],
      capabilities: stringList(operation["x-required-capabilities"], `${id}.x-required-capabilities`),
      deprecated: operation["deprecated"] === true,
    });
  }
}

// --- Map operations ---------------------------------------------------------------------
const operationsRaw = prop(map, "operations");
if (map !== null && !Array.isArray(operationsRaw)) problems.push("the map has no `operations` list");
/** @type {Set<string>} */
const seenIds = new Set();
/** @type {Set<string>} */
const seenRoutes = new Set();
/** @type {Record<string, number>} */
const counts = { planned: 0, built: 0, deprecated: 0, retired: 0 };
const roots = { repoRoot, constitution, mvpDocs };

/** @typedef {{ id: string; where: string; method: string; route: string; status: string; consumerName: string; tag: string; capabilities: string[] }} MapOp */

/**
 * Reads the fields of an entry and checks identity: operationId, method, path, status, duplicates.
 * @param {Record<string, unknown>} entry
 * @param {number} i
 * @returns {MapOp}
 */
function readEntry(entry, i) {
  const id = typeof entry["operationId"] === "string" ? entry["operationId"] : `operations[${i}]`;
  const where = `operation ${id}`;
  if (typeof entry["operationId"] !== "string") problems.push(`${where}: operationId is missing`);
  if (seenIds.has(id)) problems.push(`${where}: duplicate operationId`);
  seenIds.add(id);
  const method = String(entry["method"] ?? "");
  const route = String(entry["path"] ?? "");
  if (!HTTP_METHODS_LOWER.includes(method))
    problems.push(`${where}: method "${method}" is not an HTTP method`);
  if (!/^\/v\d+\//.test(route)) problems.push(`${where}: path "${route}" has no /v<major>/ prefix`);
  const routeKey = `${method} ${route}`;
  if (seenRoutes.has(routeKey)) problems.push(`${where}: duplicate method and path (${routeKey})`);
  seenRoutes.add(routeKey);
  const status = String(entry["status"] ?? "");
  if (!STATUSES.includes(status))
    problems.push(`${where}: status "${status}" is not one of ${STATUSES.join(", ")}`);
  else counts[status] = (counts[status] ?? 0) + 1;
  return {
    id,
    where,
    method,
    route,
    status,
    consumerName: String(entry["consumer"] ?? ""),
    tag: String(entry["tag"] ?? ""),
    capabilities: stringList(entry["capabilities"], `${where}.capabilities`),
  };
}

/**
 * Consumer, tag, capabilities and the admin-only merchantId path parameter.
 * @param {MapOp} o
 * @returns {Consumer | undefined}
 */
function checkConsumer(o) {
  const consumer = consumers.get(o.consumerName);
  if (!consumer) problems.push(`${o.where}: consumer "${o.consumerName}" is not declared`);
  else if (!consumer.tags.includes(o.tag)) {
    problems.push(`${o.where}: tag "${o.tag}" does not belong to consumer ${o.consumerName}`);
  }
  const vocabulary = consumer?.capabilities ?? [];
  for (const c of o.capabilities) {
    if (consumer && !vocabulary.includes(c)) {
      problems.push(`${o.where}: capability "${c}" is outside the vocabulary of consumer ${o.consumerName}`);
    }
  }
  if (o.consumerName === "public" && o.capabilities.length > 0) {
    problems.push(`${o.where}: public operations declare no capabilities`);
  }
  if (/\{merchantId\}/.test(o.route) && o.consumerName !== "admin") {
    problems.push(
      `${o.where}: {merchantId} in the path is allowed only under the admin consumer (constitution V, ADR-020)`,
    );
  }
  return consumer;
}

/**
 * @param {Record<string, unknown>} entry
 * @param {MapOp} o
 */
function checkFeatureAndSource(entry, o) {
  const feature = String(entry["feature"] ?? "");
  if (!FEATURE.test(feature)) problems.push(`${o.where}: feature "${feature}" is not a three-digit number`);
  else if (!specFeatures.has(feature) && !roadmap.has(feature)) {
    problems.push(
      `${o.where}: feature ${feature} has neither a specs/${feature}-* directory nor a features entry in the map`,
    );
  }
  const source = entry["source"];
  if (typeof source !== "string" || source === "") {
    problems.push(`${o.where}: source is missing`);
    return;
  }
  const { problem, warning } = verifySource(source, o.where, roots);
  if (problem) problems.push(problem);
  if (warning) warnings.push(warning);
}

/**
 * A built or deprecated entry against its contract operation, field by field.
 * @param {MapOp} o
 * @param {ContractOp} c
 * @param {Consumer | undefined} consumer
 */
function checkAgainstContract(o, c, consumer) {
  if (c.method !== o.method || c.path !== o.route) {
    problems.push(`${o.where}: the contract has ${c.method} ${c.path}, the map says ${o.method} ${o.route}`);
  }
  if (c.tags.length !== 1 || c.tags[0] !== o.tag) {
    problems.push(`${o.where}: the contract tags are [${c.tags.join(", ")}], the map says ${o.tag}`);
  }
  const expectedSecurity = consumer?.scheme === null ? [] : [{ [String(consumer?.scheme)]: [] }];
  if (JSON.stringify(c.security) !== JSON.stringify(expectedSecurity)) {
    problems.push(
      `${o.where}: the contract security is ${JSON.stringify(c.security)}, consumer ${o.consumerName} requires ${JSON.stringify(expectedSecurity)}`,
    );
  }
  if (JSON.stringify([...c.capabilities].sort()) !== JSON.stringify([...o.capabilities].sort())) {
    problems.push(
      `${o.where}: the contract capabilities are [${c.capabilities.join(", ")}], the map says [${o.capabilities.join(", ")}]`,
    );
  }
  if (o.status === "deprecated" && !c.deprecated) {
    problems.push(`${o.where}: the map says deprecated but the contract operation has no deprecated: true`);
  }
  if (o.status === "built" && c.deprecated) {
    problems.push(`${o.where}: the contract operation is deprecated: true but the map says built`);
  }
}

/**
 * Lifecycle: built/deprecated must be in the contract (and match); planned/retired must not.
 * @param {Record<string, unknown>} entry
 * @param {MapOp} o
 * @param {Consumer | undefined} consumer
 */
function checkLifecycle(entry, o, consumer) {
  const c = contractOps.get(o.id);
  if (IN_CONTRACT.includes(o.status)) {
    if (c) checkAgainstContract(o, c, consumer);
    else problems.push(`${o.where}: status ${o.status} but the contract has no such operation`);
  } else if (c) {
    problems.push(`${o.where}: status ${o.status} but the contract still declares the operation`);
  }
  if (o.status === "retired" && typeof entry["retiredIn"] !== "string") {
    problems.push(`${o.where}: retired operations need retiredIn (the major version that removed them)`);
  }
}

for (const [i, entry] of (Array.isArray(operationsRaw) ? operationsRaw : []).entries()) {
  if (!isRecord(entry)) {
    problems.push(`operations[${i}]: must be an object`);
    continue;
  }
  const o = readEntry(entry, i);
  const consumer = checkConsumer(o);
  checkFeatureAndSource(entry, o);
  checkLifecycle(entry, o, consumer);
}

// Contract → map.
for (const id of contractOps.keys()) {
  if (!seenIds.has(id)) {
    problems.push(
      `operation ${id}: declared in the contract but absent from the map (add it as planned first, then built)`,
    );
  }
}

for (const w of warnings) console.log(`warning: ${w}`);
process.exit(
  report(
    problems,
    `Map: ${counts["built"]} built, ${counts["planned"]} planned, ${counts["deprecated"]} deprecated, ${counts["retired"]} retired`,
  ),
);
