// Feature 021 — the rule that says which operations leave an entry in the administration log is
// derived from the contract, not written by hand. These fixtures pin the three cases that decide
// it, so a change in the derivation cannot pass unnoticed.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { stringify } from "yaml";

/** What the generator exports; the script is JavaScript, so its shape is declared here. */
interface Generator {
  readAuditedOperations: (bundle: string, map: string) => string[];
  renderAuditedOperations: (audited: string[]) => string;
}

let readAuditedOperations: Generator["readAuditedOperations"];
let renderAuditedOperations: Generator["renderAuditedOperations"];

const MAP = {
  consumers: {
    public: { securityScheme: null, tags: ["system"], capabilities: [] },
    sdk: { securityScheme: "ingestKey", tags: ["ingest"], capabilities: ["events:write"] },
    admin: {
      securityScheme: "adminToken",
      tags: ["admin"],
      capabilities: ["merchants:read", "merchants:write"],
    },
  },
};

const operation = (operationId: string, tag: string, capabilities: string[]): unknown => ({
  operationId,
  tags: [tag],
  "x-required-capabilities": capabilities,
  responses: { 200: { description: "ok" } },
});

const BUNDLE = {
  openapi: "3.1.0",
  info: { title: "f", version: "1.0.0" },
  paths: {
    "/v1/health": { get: { operationId: "getHealth", tags: ["system"], responses: {} } },
    "/v1/events": { post: operation("ingestEvents", "ingest", ["events:write"]) },
    "/v1/admin/merchants": {
      get: operation("listMerchants", "admin", ["merchants:read"]),
      post: operation("createMerchant", "admin", ["merchants:write"]),
    },
  },
};

/** The two files the derivation reads, written once for the whole suite. */
function written(): { bundle: string; map: string } {
  const dir = path.join(import.meta.dirname, "fixtures", "audited-operations");
  mkdirSync(dir, { recursive: true });
  const bundle = path.join(dir, "bundle.yaml");
  const map = path.join(dir, "api-map.yaml");
  writeFileSync(bundle, stringify(BUNDLE), "utf8");
  writeFileSync(map, stringify(MAP), "utf8");
  return { bundle, map };
}

describe("which operations the contract orders to be audited", () => {
  const { bundle, map } = written();
  let audited: string[];
  beforeAll(async () => {
    const mod = (await import(
      pathToFileURL(path.resolve("scripts/contract-audited-operations-lib.mjs")).href
    )) as Generator;
    ({ readAuditedOperations, renderAuditedOperations } = mod);
    audited = readAuditedOperations(bundle, map);
  });

  it("an administration operation that writes is audited", () => {
    expect(audited).toContain("createMerchant");
  });

  it("an administration operation that only reads is not", () => {
    expect(audited).not.toContain("listMerchants");
  });

  it("writing is not enough: the consumer has to be the administration", () => {
    // `ingestEvents` asks for `events:write`, which is a write, and is never audited: the
    // administration log records what an operator did, not what the SDK sent.
    expect(audited).not.toContain("ingestEvents");
  });

  it("an operation without capabilities is not audited", () => {
    expect(audited).not.toContain("getHealth");
  });

  it("the declaration is the union of what was derived, in the order of the bundle", () => {
    expect(renderAuditedOperations(audited)).toContain(
      'export type AuditedOperation =\n  | "createMerchant";',
    );
  });

  it("with nothing to audit the declaration is `never`, and still compiles", () => {
    expect(renderAuditedOperations([])).toContain("export type AuditedOperation = never;");
  });
});
