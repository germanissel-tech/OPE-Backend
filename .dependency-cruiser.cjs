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
// Modules (inside domain/, application/ and interface-adapters/): a module imports from another
// only through its index.ts and only if CONTEXT_MAP allows it. Adding a module = adding an entry
// here. The adapters ring (feature 018) is cut by module too — interface-adapters/<module>/
// {controllers,presenters.ts,security,gateways,index.ts} — with a core, interface-adapters/http/,
// that knows no feature module (typed handlers, Problem Details, generic boundary, principals);
// composition/modules/<module>.ts imports from the ring only the index of its module (and the
// shared-kernel); a gateway takes drivers only from infrastructure/.

// Non-capturing group: the `$1`/`$2` back-references must point at the rules' own groups.
const SRC = "(?:^|/)src/";
const MOD = `${SRC}(domain|application|interface-adapters)/`;
/** The core of the adapters ring: not a module, importable by every module of the ring. */
const CORE = `${SRC}interface-adapters/http/`;
/** What the core may know of the inner rings: the kernels and the principals a request resolves to. */
const CORE_MAY_KNOW = `${SRC}(domain/(shared-kernel|operator|merchant)/|application/shared-kernel/)`;

/** Context map: module → modules it may depend on (besides itself). */
const CONTEXT_MAP = {
  "shared-kernel": [],
  system: ["shared-kernel"],
  operator: ["shared-kernel"],
  merchant: ["shared-kernel", "operator"],
  ledger: ["shared-kernel"],
  experiment: ["shared-kernel", "ledger", "operator", "merchant"],
  ingestion: ["shared-kernel", "merchant", "ledger", "experiment"],
  catalog: ["shared-kernel", "ledger"],
  barrier: ["shared-kernel", "ingestion"],
  selection: ["shared-kernel"],
  // Feature 027: messages owns the curated corpus. It needs selection for the message family
  // (barrier, anchor, step) and nothing else — it receives the attribute value already resolved,
  // never the product, so it does not depend on catalog.
  messages: ["shared-kernel", "selection"],
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
  outcomes: ["shared-kernel", "ledger"],
  // Feature 017 (ADR-031): configuration owns the three levels and the resolution; nobody
  // imports it (consumers define their read port, composition binds). admin owns operators,
  // the admin log and anchor diagnostics.
  configuration: [
    "shared-kernel",
    "operator",
    "merchant",
    "experiment",
    "decision",
    "commercial",
    "selection",
    "catalog",
    "ingestion",
    "barrier",
  ],
  admin: ["shared-kernel", "operator", "merchant", "configuration", "experiment"],
  // Feature 020 (ADR-034): access owns the three schemes, their resolvers and the policies of the
  // platform level they depend on. It reads the merchant directory and never writes to it: that
  // direction is what keeps the merchant module with a single reason to change.
  access: ["shared-kernel", "operator", "merchant"],
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
  to: { path: `${MOD}[^/]+/`, pathNot: [`${MOD}(${[mod, ...allowed].join("|")})/`, CORE] },
}));

/** Where a module wires itself: one file per module, judged by the same map (ADR-033, FR-011). */
const WIRING = `${SRC}composition/modules/`;

/**
 * The context map rules the composition too: consuming something of another module is an import of
 * its port, so the same arcs apply to `composition/modules/<module>.ts` (feature 020, ADR-033).
 * @type {import('dependency-cruiser').IForbiddenRuleType[]}
 */
const wiringContextRules = Object.entries(CONTEXT_MAP).map(([mod, allowed]) => {
  const reachable = [mod, ...allowed].join("|");
  return {
    name: `context-map:composition/${mod}`,
    comment: `composition/modules/${mod}.ts depends only on: ${[mod, ...allowed].join(", ")} (context map, ADR-033)`,
    severity: "error",
    from: { path: `${WIRING}${mod}\\.ts$` },
    to: {
      path: `(${MOD}[^/]+/|${WIRING}[^/]+\\.ts$)`,
      pathNot: [`${MOD}(${reachable})/`, `${WIRING}(${reachable})\\.ts$`, CORE],
    },
  };
});

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
        "Outside composition/modules/, the composition root imports neither controllers, security handlers nor use cases: each module wires its own, the root keeps the list of modules (ADR-013). The configuration readers (config.ts and *-config.ts) are the exception: they read the shape of the inputs through the readers of the configuration module (ADR-024, ADR-031).",
      severity: "error",
      from: { path: `${SRC}composition/`, pathNot: `${SRC}composition/(modules/|[a-z-]*config[.]ts$)` },
      to: {
        path: `${SRC}(interface-adapters/[^/]+/(controllers|security)/|application/)`,
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "profiles-compose-modules",
      comment:
        "A profile is a deployment: it composes one binding table per module (composition/modules/<module>.ts); it never picks gateways itself (ADR-013).",
      severity: "error",
      from: { path: `${SRC}composition/profiles/` },
      to: { path: `${SRC}interface-adapters/[^/]+/gateways/` },
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
      from: { path: `${MOD}([^/]+)/`, pathNot: CORE },
      to: { path: `${MOD}[^/]+/`, pathNot: [`${MOD}$2/`, `${MOD}[^/]+/index\\.ts$`, CORE] },
    },
    ...contextRules,
    ...wiringContextRules,
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
        "A DomainError becomes Problem Details only at the HTTP boundary of the adapters ring (toProblem): controllers, presenters and security handlers; never a gateway, never another ring.",
      severity: "error",
      from: { pathNot: `${SRC}interface-adapters/(?!gateways/|[^/]+/gateways/)` },
      to: { path: `${SRC}interface-adapters/http/to-problem\\.ts$` },
    },
    {
      name: "gateways-no-cross",
      comment:
        "A gateway implements the port of its module; it does not import another gateway (they are wired in composition). What the in-memory gateways share (the bounded window per merchant) lives in gateways/shared-kernel/, which implements no port.",
      severity: "error",
      from: { path: `${SRC}interface-adapters/([^/]+)/gateways/` },
      to: {
        path: `${SRC}interface-adapters/([^/]+)/gateways/`,
        pathNot: [`${SRC}interface-adapters/$1/gateways/`, `${SRC}interface-adapters/shared-kernel/`],
      },
    },
    {
      name: "controllers-no-gateways",
      comment: "A controller receives use cases; it does not instantiate gateways.",
      severity: "error",
      from: { path: `${SRC}interface-adapters/([^/]+/(controllers|security)/|http/)` },
      to: { path: `${SRC}interface-adapters/[^/]+/gateways/` },
    },
    // --- Adapters ring by module (feature 018) ---------------------------------------------
    {
      name: "adapters-core-knows-no-module",
      comment:
        "The core of the adapters ring (interface-adapters/http/) knows no feature module: neither a module of the ring nor a module of domain or application beyond the kernels and the principals (shared-kernel, operator, merchant).",
      severity: "error",
      from: { path: CORE },
      to: {
        path: `${SRC}(interface-adapters/(?!http/)[^/]+/|(domain|application)/[^/]+/)`,
        pathNot: CORE_MAY_KNOW,
      },
    },
    {
      name: "composition-imports-module-index",
      comment:
        "composition/modules/<module>.ts imports from the adapters ring only interface-adapters/<module>/index.ts and the shared-kernel of the ring; what crosses modules lives in composition/adapters/.",
      severity: "error",
      from: { path: `${SRC}composition/modules/([^/]+)\\.ts$` },
      to: {
        path: `${SRC}interface-adapters/`,
        pathNot: [
          `${SRC}interface-adapters/$1/index\\.ts$`,
          `${SRC}interface-adapters/shared-kernel/index\\.ts$`,
          CORE,
        ],
      },
    },
    {
      name: "generated-only-from-http-core",
      comment:
        "What the contract generates (generated/, reached by #generated/*) is read only by the core of the adapters ring and by the HTTP infrastructure; the modules of the ring take the contract types from the core (typed.ts).",
      severity: "error",
      from: { pathNot: `${SRC}(interface-adapters/http/|infrastructure/http/)` },
      to: { path: "(?:^|/)generated/" },
    },
    {
      name: "gateways-drivers-from-infrastructure",
      comment:
        "A gateway implements a port with what Node offers or with a driver infrastructure/ provides; it never imports an npm package itself (the driver of the persistence enters by infrastructure/).",
      severity: "error",
      from: { path: `${SRC}interface-adapters/[^/]+/gateways/` },
      to: { dependencyTypes: EXTERNAL.filter((type) => type !== "core") },
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
      comment: "Every module of src/ is used by someone, except main.ts (root) and generated files.",
      severity: "error",
      from: {
        orphan: true,
        pathNot: [`${SRC}main\\.ts$`, "\\.d\\.ts$"],
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
