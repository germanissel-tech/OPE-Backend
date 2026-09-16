// Dirección de dependencias entre capas (ADR-006; constitución I). `npm run arch` y
// tests/architecture/architecture.test.ts la hacen cumplir. Las rutas usan `(^|/)src/…` para
// que los fixtures bajo tests/architecture/fixtures/src/ matcheen las mismas reglas.
//
//   domain   → domain                                   (nada de npm ni de Node, tipos incluidos)
//   ports    → domain, ports
//   adapters → ports, domain, el propio adaptador, generated, npm/Node (+ tipos de handlers/typed.ts)
//   handlers → domain, ports, generated, handlers
//   client   → generated, npm
//   main.ts  → todo; nadie lo importa

// Grupo no capturante: `$1` en adapters-no-cross debe ser el nombre del adaptador.
const SRC = "(?:^|/)src/";
/** @param {string} name */
/** @param {string} name */
const layer = (name) => `${SRC}${name}/`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-is-pure",
      comment: "El dominio no depende de npm ni de módulos de Node: ni en runtime ni en tipos.",
      severity: "error",
      from: { path: layer("domain") },
      to: {
        dependencyTypes: [
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
        ],
      },
    },
    {
      name: "domain-no-layers",
      comment: "El dominio no conoce puertos, adaptadores, manejadores, cliente, generated ni main.",
      severity: "error",
      from: { path: layer("domain") },
      to: { path: `${SRC}(ports|adapters|handlers|client|generated|main\\.ts)` },
    },
    {
      name: "ports-only-domain",
      comment: "Los puertos son interfaces sobre el dominio.",
      severity: "error",
      from: { path: layer("ports") },
      to: { path: `${SRC}(adapters|handlers|client|generated|main\\.ts)` },
    },
    {
      name: "ports-are-pure",
      severity: "error",
      from: { path: layer("ports") },
      to: {
        dependencyTypes: [
          "npm",
          "npm-dev",
          "npm-optional",
          "npm-peer",
          "npm-bundled",
          "npm-no-pkg",
          "npm-unknown",
          "core",
        ],
      },
    },
    {
      name: "adapters-no-cross",
      comment: "Un adaptador no importa de otro adaptador: se conectan en el composition root.",
      severity: "error",
      from: { path: `${SRC}adapters/([^/]+)/` },
      to: { path: `${SRC}adapters/([^/]+)/`, pathNot: `${SRC}adapters/$1/` },
    },
    {
      name: "adapters-no-handlers",
      comment: "Un adaptador no importa manejadores; sólo los tipos de handlers/typed.ts.",
      severity: "error",
      from: { path: layer("adapters") },
      to: { path: layer("handlers"), pathNot: `${SRC}handlers/typed\\.ts$` },
    },
    {
      name: "adapters-typed-only-types",
      comment: "La única dependencia adaptador → handlers es de tipos (handlers/typed.ts).",
      severity: "error",
      from: { path: layer("adapters") },
      to: { path: `${SRC}handlers/typed\\.ts$`, dependencyTypesNot: ["type-only"] },
    },
    {
      name: "handlers-no-adapters",
      comment: "Los manejadores reciben sus dependencias por puertos; no instancian infraestructura.",
      severity: "error",
      from: { path: layer("handlers") },
      to: { path: `${SRC}(adapters|client|main\\.ts)` },
    },
    {
      name: "handlers-no-runtime-npm",
      severity: "error",
      from: { path: layer("handlers") },
      to: {
        dependencyTypes: [
          "npm",
          "npm-dev",
          "npm-optional",
          "npm-peer",
          "npm-bundled",
          "npm-no-pkg",
          "npm-unknown",
          "core",
        ],
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "client-only-generated",
      comment: "El cliente sólo conoce los tipos generados y openapi-fetch.",
      severity: "error",
      from: { path: layer("client") },
      to: { path: `${SRC}(domain|ports|adapters|handlers|main\\.ts)` },
    },
    {
      name: "nobody-imports-main",
      comment: "main.ts es el composition root: es raíz del grafo, nadie lo importa.",
      severity: "error",
      from: {},
      to: { path: `${SRC}main\\.ts$` },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      comment: "Todo módulo de src/ lo usa alguien, salvo main.ts (raíz), client (entrypoint) y generated.",
      severity: "error",
      from: {
        orphan: true,
        pathNot: [`${SRC}main\\.ts$`, layer("client"), layer("generated"), "\\.d\\.ts$"],
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
