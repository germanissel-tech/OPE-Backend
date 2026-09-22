// Feature 004 (constitution II, fail-closed): every operation the contract file declares has to be
// served, or the process does not start. The compiler checks the deployment against the types the
// contract generates (tests/typecheck/fixtures/graph-operation-unwired.ts); this checks the file
// the process loads, which may declare more than the binary knows.
import { describe, expect, it } from "vitest";
import { assertEveryOperationWired, unwiredOperations } from "../../../src/composition/coverage.js";
import type { ContractDocument } from "../../../src/infrastructure/http/build-server.js";
import type { Handlers } from "../../../src/interface-adapters/http/typed.js";

const getHealth = (): never => {
  throw new Error("not called");
};

const contract = {
  openapi: "3.1.0",
  info: { title: "t", version: "1.0.0" },
  paths: {
    "/v1/health": { get: { operationId: "getHealth", responses: {} } },
    "/v1/things": {
      get: { operationId: "listThings", responses: {} },
      post: { operationId: "createThing", responses: {} },
      // A path item without operations (only a summary) declares nothing to serve.
      summary: "things",
    },
  },
} as unknown as ContractDocument;

describe("unwiredOperations", () => {
  it("lists, in contract order, the operationIds no handler serves", () => {
    expect(unwiredOperations(contract, { getHealth })).toEqual(["listThings", "createThing"]);
  });

  it("is empty when every declared operation has a handler", () => {
    const all = { getHealth, listThings: getHealth, createThing: getHealth } as unknown as Handlers;
    expect(unwiredOperations(contract, all)).toEqual([]);
    expect(() => {
      assertEveryOperationWired(contract, all);
    }).not.toThrow();
  });

  it("a contract without paths declares nothing", () => {
    expect(unwiredOperations({ ...contract, paths: undefined } as unknown as ContractDocument, {})).toEqual(
      [],
    );
  });

  it("assertEveryOperationWired names every missing operation and where to serve it", () => {
    expect(() => {
      assertEveryOperationWired(contract, { getHealth });
    }).toThrow(
      /no module wires: listThings, createThing\. Serve each one from its module in src\/composition\/modules\//,
    );
  });
});
