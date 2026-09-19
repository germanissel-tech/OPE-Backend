// Rings, modules and context map (ADR-013; constitution I). `npm run arch` and
// tests/architecture/architecture.test.ts enforce it. Paths use `(?:^|/)src/…` so that the
// fixtures under tests/architecture/fixtures/src/ match the same rules.
//
// Rings (dependency inward only):
//   domain             → domain                        (nothing from npm or Node, types included)
//   application        → domain, application
//   interface-adapters → application, domain, interface-adapters, npm
//   infrastructure     → everything but composition and main.ts
//   composition        → everything; only main.ts (and the tests) import it. Controllers, security
//                        handlers, use cases and gateways are bound in composition/modules/<module>.ts;
//                        a profile (composition/profiles/) composes modules, it never picks gateways
//   main.ts            → composition and Node; nobody imports it
//
// Modules (inside domain/ and application/): a module imports from another only through its
// index.ts and only if CONTEXT_MAP allows it. Adding a module = adding an entry here.

// Non-capturing group: the `$1`/`$2` back-references must point at the rules' own groups.
const SRC = "(?:^|/)src/";
const MOD = `${SRC}(domain|application)/`;

/** Context map: module → modules it may depend on (besides itself). */
const CONTEXT_MAP = {
  "shared-kernel": [],
  system: ["shared-kernel"],
  merchant: ["shared-kernel"],
  ledger: ["shared-kernel"],
  experiment: ["shared-kernel", "ledger"],
  ingestion: ["shared-kernel", "merchant", "ledger", "experiment"],
  catalog: ["shared-kernel"],
  barrier: ["shared-kernel", "ingestion"],
  selection: ["shared-kernel"],
  commercial: ["shared-kernel", "barrier", "selection"],
  decision: [
    "shared-kernel",
    "ledger",
    "experiment",
    "ingestion",
    "catalog",
    "barrier",
    "selection",
    "commercial",
  ],
};

/**
 * Dependency types that leave the repo: npm and Node modules.
 * @type {import("dependency-cruiser").DependencyType[]}
 */
const EXTERNAL = [
  "npm",
  "npm-dev",
  "npm-optional",
  "npm-peer",
  "npm-bundled",
  "npm-no-pkg",
  "npm-unknown",
  "core",
  "deprecated",
  "unknown",
  "undetermined",
];

/** @type {import('dependency-cruiser').IForbiddenRuleType[]} */
const contextRules = Object.entries(CONTEXT_MAP).map(([mod, allowed]) => ({
  name: `context-map:${mod}`,
  comment: `${mod} depends only on: ${[mod, ...allowed].join(", ")} (context map, ADR-013)`,
  severity: "error",
  from: { path: `${MOD}${mod}/` },
  to: { path: `${MOD}[^/]+/`, pathNot: `${MOD}(${[mod, ...allowed].join("|")})/` },
}));

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // --- Rings ------------------------------------------------------------------------
    {
      name: "domain-is-pure",
      comment: "The domain depends neither on npm nor on Node modules: not at runtime, not in types.",
      severity: "error",
      from: { path: `${SRC}domain/` },
      to: { dependencyTypes: EXTERNAL },
    },
    {
      name: "domain-inward",
      comment: "The domain knows nothing of application, adapters, infrastructure, composition or main.",
      severity: "error",
      from: { path: `${SRC}domain/` },
      to: { path: `${SRC}(application|interface-adapters|infrastructure|composition|main\\.ts)` },
    },
    {
      name: "application-inward",
      comment: "Use cases talk to the world through ports; they know nothing of adapters or infrastructure.",
      severity: "error",
      from: { path: `${SRC}application/` },
      to: { path: `${SRC}(interface-adapters|infrastructure|composition|main\\.ts)` },
    },
    {
      name: "application-is-pure",
      comment: "The application does not depend on npm or Node either: its dependencies are ports.",
      severity: "error",
      from: { path: `${SRC}application/` },
      to: { dependencyTypes: EXTERNAL },
    },
    {
      name: "adapters-inward",
      comment: "Interface adapters know nothing of infrastructure or composition.",
      severity: "error",
      from: { path: `${SRC}interface-adapters/` },
      to: { path: `${SRC}(infrastructure|composition|main\\.ts)` },
    },
    {
      name: "infrastructure-inward",
      comment: "Infrastructure knows nothing of composition or main.",
      severity: "error",
      from: { path: `${SRC}infrastructure/` },
      to: { path: `${SRC}(composition|main\\.ts)` },
    },
    {
      name: "nobody-imports-composition",
      comment: "Only main.ts (and the tests) import the composition root.",
      severity: "error",
      from: { path: `${SRC}`, pathNot: `${SRC}(composition/|main\\.ts$)` },
      to: { path: `${SRC}composition/` },
    },
    {
      name: "composition-wires-by-module",
      comment:
        "Outside composition/modules/, the composition root imports neither controllers, security handlers nor use cases: each module wires its own, the root keeps the list of modules (ADR-013).",
      severity: "error",
      from: { path: `${SRC}composition/`, pathNot: `${SRC}composition/modules/` },
      to: {
        path: `${SRC}(interface-adapters/http/(controllers|security)/|application/)`,
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "profiles-compose-modules",
      comment:
        "A profile is a deployment: it composes one binding table per module (composition/modules/<module>.ts); it never picks gateways itself (ADR-013).",
      severity: "error",
      from: { path: `${SRC}composition/profiles/` },
      to: { path: `${SRC}interface-adapters/gateways/` },
    },
    {
      name: "nobody-imports-main",
      comment: "main.ts is the root of the graph; nobody imports it.",
      severity: "error",
      from: {},
      to: { path: `${SRC}main\\.ts$` },
    },
    // --- Modules ------------------------------------------------------------------------
    {
      name: "modules-only-via-index",
      comment: "A module imports from another only through its index.ts (public API).",
      severity: "error",
      from: { path: `${MOD}([^/]+)/` },
      to: { path: `${MOD}[^/]+/`, pathNot: [`${MOD}$2/`, `${MOD}[^/]+/index\\.ts$`] },
    },
    ...contextRules,
    // --- Application ring (ADR-023) -------------------------------------------------------------
    {
      name: "use-cases-no-use-cases",
      comment:
        "A use case is the entry point of one intention; it never invokes another use case. Shared logic is a service.",
      severity: "error",
      from: { path: `${SRC}application/[^/]+/use-cases/` },
      to: { path: `${SRC}application/[^/]+/use-cases/` },
    },
    {
      name: "services-no-use-cases",
      comment: "An application service is used by use cases; it does not import them.",
      severity: "error",
      from: { path: `${SRC}application/[^/]+/services/` },
      to: { path: `${SRC}application/[^/]+/use-cases/` },
    },
    {
      name: "problem-translation-only-in-http",
      comment:
        "A DomainError becomes Problem Details only in the HTTP adapter (toProblem): controllers and security handlers.",
      severity: "error",
      from: { pathNot: `${SRC}interface-adapters/http/` },
      to: { path: `${SRC}interface-adapters/http/to-problem\\.ts$` },
    },
    {
      name: "gateways-no-cross",
      comment:
        "A gateway implements the port of its module; it does not import another gateway (they are wired in composition).",
      severity: "error",
      from: { path: `${SRC}interface-adapters/gateways/([^/]+)/` },
      to: {
        path: `${SRC}interface-adapters/gateways/([^/]+)/`,
        pathNot: `${SRC}interface-adapters/gateways/$1/`,
      },
    },
    {
      name: "controllers-no-gateways",
      comment: "A controller receives use cases; it does not instantiate gateways.",
      severity: "error",
      from: { path: `${SRC}interface-adapters/http/` },
      to: { path: `${SRC}interface-adapters/gateways/` },
    },
    // --- General ----------------------------------------------------------------------
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      comment:
        "Every module of src/ is used by someone, except main.ts (root), the client (entrypoint) and generated files.",
      severity: "error",
      from: {
        orphan: true,
        pathNot: [`${SRC}main\\.ts$`, `${SRC}interface-adapters/http/client\\.ts$`, "\\.d\\.ts$"],
      },
      to: {},
    },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: "specify",
    doNotFollow: { path: "node_modules" },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
