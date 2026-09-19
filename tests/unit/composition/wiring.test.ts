// ADR-013 (amendment): modules wire themselves; the root merges what they serve and refuses a
// key claimed twice. Coverage: every operationId of the contract must be served, or nothing starts.
import { describe, expect, it } from "vitest";
import { assertEveryOperationWired, unwiredOperations } from "../../../src/composition/coverage.js";
import { wireModules, type Module } from "../../../src/composition/wiring.js";
import type { ContractDocument } from "../../../src/infrastructure/http/build-server.js";
import type {
  Handlers,
  OperationHandler,
  SecurityScheme,
} from "../../../src/interface-adapters/http/typed.js";

const handler = (): never => {
  throw new Error("not called");
};
const getHealth = handler as unknown as OperationHandler<"getHealth">;
const ingestEvents = handler as unknown as OperationHandler<"ingestEvents">;
const security: SecurityScheme = {
  handler: () => ({ principal: null, capabilities: [] }),
  header: "x-test-key",
  consumer: "browser",
};
const cors = { isRegisteredOrigin: () => Promise.resolve(true) };
const contractOf = (version: string) =>
  ({ openapi: "3.1.0", info: { title: "t", version }, paths: {} }) as ContractDocument;
const context = { ports: {}, contract: contractOf("1.0.0") };

describe("wireModules", () => {
  it("merges handlers, security schemes and the CORS policy of every module, in order", () => {
    const seen: string[] = [];
    const modules: Module<object>[] = [
      () => (seen.push("a"), { handlers: { getHealth } }),
      () => (seen.push("b"), { security: { ingestKey: security }, cors }),
      () => (seen.push("c"), { handlers: { ingestEvents } }),
      () => (seen.push("d"), {}),
    ];
    const wired = wireModules(modules, context);
    expect(seen).toEqual(["a", "b", "c", "d"]);
    expect(wired.handlers).toEqual({ getHealth, ingestEvents });
    expect(wired.security).toEqual({ ingestKey: security });
    expect(wired.cors).toBe(cors);
  });

  it("without a CORS policy the result carries none", () => {
    expect("cors" in wireModules([() => ({ handlers: { getHealth } })], context)).toBe(false);
  });

  it("passes every module the same ports and contract", () => {
    const ports = { clock: { now: () => new Date() } };
    const contract = contractOf("2.0.0");
    const received: unknown[] = [];
    wireModules<typeof ports>([(c) => (received.push(c), {}), (c) => (received.push(c), {})], {
      ports,
      contract,
    });
    expect(received).toEqual([
      { ports, contract },
      { ports, contract },
    ]);
  });

  it("two modules wiring the same operation is a wiring error, not a silent override", () => {
    const modules: Module<object>[] = [
      () => ({ handlers: { getHealth } }),
      () => ({ handlers: { getHealth } }),
    ];
    expect(() => wireModules(modules, context)).toThrow('Two modules wire the operation "getHealth".');
  });

  it("two modules serving the same security scheme is a wiring error", () => {
    const modules: Module<object>[] = [
      () => ({ security: { ingestKey: security } }),
      () => ({ security: { ingestKey: security } }),
    ];
    expect(() => wireModules(modules, context)).toThrow('Two modules wire the security scheme "ingestKey".');
  });

  it("two modules declaring a CORS policy is a wiring error", () => {
    const modules: Module<object>[] = [() => ({ cors }), () => ({ cors })];
    expect(() => wireModules(modules, context)).toThrow("Two modules declare the CORS policy.");
  });
});

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
