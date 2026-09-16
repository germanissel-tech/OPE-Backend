// Anillos, módulos y mapa de contextos (ADR-013; constitución I). `npm run arch` y
// tests/architecture/architecture.test.ts la hacen cumplir. Las rutas usan `(?:^|/)src/…` para
// que los fixtures bajo tests/architecture/fixtures/src/ matcheen las mismas reglas.
//
// Anillos (dependencia sólo hacia adentro):
//   domain             → domain                        (nada de npm ni de Node, tipos incluidos)
//   application        → domain, application
//   interface-adapters → application, domain, interface-adapters, npm
//   infrastructure     → todo menos composition y main.ts
//   composition        → todo; sólo main.ts (y las pruebas) lo importan
//   main.ts            → composition y Node; nadie lo importa
//
// Módulos (dentro de domain/ y application/): un módulo importa de otro sólo por su index.ts y
// sólo si CONTEXT_MAP lo permite. Agregar un módulo = agregar una entrada acá.

// Grupo no capturante: los back-references `$1`/`$2` deben apuntar a los grupos de las reglas.
const SRC = "(?:^|/)src/";
const MOD = `${SRC}(domain|application)/`;

/** Mapa de contextos: módulo → módulos de los que puede depender (además de sí mismo). */
const CONTEXT_MAP = {
  "shared-kernel": [],
  system: ["shared-kernel"],
  merchant: ["shared-kernel"],
  ledger: ["shared-kernel"],
  ingestion: ["shared-kernel", "merchant", "ledger"],
};

/** Tipos de dependencia que salen del repo: npm y módulos de Node. */
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
  comment: `${mod} sólo depende de: ${[mod, ...allowed].join(", ")} (mapa de contextos, ADR-013)`,
  severity: "error",
  from: { path: `${MOD}${mod}/` },
  to: { path: `${MOD}[^/]+/`, pathNot: `${MOD}(${[mod, ...allowed].join("|")})/` },
}));

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // --- Anillos --------------------------------------------------------------------------
    {
      name: "domain-is-pure",
      comment: "El dominio no depende de npm ni de módulos de Node: ni en runtime ni en tipos.",
      severity: "error",
      from: { path: `${SRC}domain/` },
      to: { dependencyTypes: EXTERNAL },
    },
    {
      name: "domain-inward",
      comment: "El dominio no conoce aplicación, adaptadores, infraestructura, composición ni main.",
      severity: "error",
      from: { path: `${SRC}domain/` },
      to: { path: `${SRC}(application|interface-adapters|infrastructure|composition|main\\.ts)` },
    },
    {
      name: "application-inward",
      comment: "Los casos de uso hablan con el mundo por puertos; no conocen adaptadores ni infraestructura.",
      severity: "error",
      from: { path: `${SRC}application/` },
      to: { path: `${SRC}(interface-adapters|infrastructure|composition|main\\.ts)` },
    },
    {
      name: "application-is-pure",
      comment: "La aplicación tampoco depende de npm ni de Node: sus dependencias son puertos.",
      severity: "error",
      from: { path: `${SRC}application/` },
      to: { dependencyTypes: EXTERNAL },
    },
    {
      name: "adapters-inward",
      comment: "Los adaptadores de interfaz no conocen la infraestructura ni la composición.",
      severity: "error",
      from: { path: `${SRC}interface-adapters/` },
      to: { path: `${SRC}(infrastructure|composition|main\\.ts)` },
    },
    {
      name: "infrastructure-inward",
      comment: "La infraestructura no conoce la composición ni main.",
      severity: "error",
      from: { path: `${SRC}infrastructure/` },
      to: { path: `${SRC}(composition|main\\.ts)` },
    },
    {
      name: "nobody-imports-composition",
      comment: "Sólo main.ts (y las pruebas) importan el composition root.",
      severity: "error",
      from: { path: `${SRC}`, pathNot: `${SRC}(composition/|main\\.ts$)` },
      to: { path: `${SRC}composition/` },
    },
    {
      name: "nobody-imports-main",
      comment: "main.ts es la raíz del grafo; nadie lo importa.",
      severity: "error",
      from: {},
      to: { path: `${SRC}main\\.ts$` },
    },
    // --- Módulos --------------------------------------------------------------------------
    {
      name: "modules-only-via-index",
      comment: "Un módulo importa de otro sólo por su index.ts (API pública).",
      severity: "error",
      from: { path: `${MOD}([^/]+)/` },
      to: { path: `${MOD}[^/]+/`, pathNot: [`${MOD}$2/`, `${MOD}[^/]+/index\\.ts$`] },
    },
    ...contextRules,
    {
      name: "gateways-no-cross",
      comment:
        "Un gateway implementa el puerto de su módulo; no importa otro gateway (se conectan en composición).",
      severity: "error",
      from: { path: `${SRC}interface-adapters/gateways/([^/]+)/` },
      to: {
        path: `${SRC}interface-adapters/gateways/([^/]+)/`,
        pathNot: `${SRC}interface-adapters/gateways/$1/`,
      },
    },
    {
      name: "controllers-no-gateways",
      comment: "Un controller recibe casos de uso; no instancia gateways.",
      severity: "error",
      from: { path: `${SRC}interface-adapters/http/` },
      to: { path: `${SRC}interface-adapters/gateways/` },
    },
    // --- Generales ------------------------------------------------------------------------
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      comment:
        "Todo módulo de src/ lo usa alguien, salvo main.ts (raíz), el cliente (entrypoint) y los generados.",
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
