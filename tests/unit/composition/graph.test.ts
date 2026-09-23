// Feature 020, US1 (FR-004..FR-007; ADR-033): the graph of one boot. What the compiler cannot
// state —identity of a derived view, one instance per boot, order that does not matter, a cycle
// that names itself, the creation order the shutdown reverses— is stated here. What it can state
// lives in tests/typecheck/fixtures/graph-*.ts.
import { describe, expect, it } from "vitest";
import {
  bind,
  bindAll,
  instantiate,
  port,
  replace,
  type Deployment,
} from "../../../src/composition/graph/index.js";

interface Store {
  put(id: string): void;
  ids(): string[];
}
interface Directory {
  ids(): string[];
}
interface Counter {
  readonly n: number;
}

const ClockPort = port("test.clock")<{ now: () => number }>();
const StorePort = port("test.store")<Store>();
const DirectoryPort = port("test.directory")<Directory>();
const CounterPort = port("test.counter")<Counter>();
const ClosablePort = port("test.closable")<{ close: () => void }>();

function memoryStore(): Store {
  const ids: string[] = [];
  return { put: (id) => void ids.push(id), ids: () => [...ids] };
}

/** How many times each builder ran during one boot. */
function counting(): { built: string[]; plan: Deployment<string> } {
  const built: string[] = [];
  const plan: Deployment<string> = {
    bindings: [
      bind(ClockPort, {}, () => {
        built.push("clock");
        return { now: () => 0 };
      }),
      // One instance, two views: whoever asks for the store and whoever asks for the directory
      // get the same object, and the builder runs once.
      bindAll([StorePort, DirectoryPort], {}, () => {
        built.push("store");
        return memoryStore();
      }),
      bind(CounterPort, { store: StorePort, clock: ClockPort }, ({ store, clock }) => {
        built.push("counter");
        return { n: store.ids().length + clock.now() };
      }),
    ],
    providedPorts: [],
    serves: [],
  };
  return { built, plan };
}

describe("the graph of one boot (ADR-033)", () => {
  it("two consumers of one component share the instance, built once", () => {
    const { built, plan } = counting();
    const graph = instantiate(plan);
    const store = graph.resolve(StorePort);
    store.put("a");
    expect(graph.resolve(CounterPort).n).toBe(1);
    expect(graph.resolve(StorePort)).toBe(store);
    expect(built.filter((name) => name === "store")).toEqual(["store"]);
  });

  it("two ports of one binding answer with the very same object, not a copy", () => {
    const { built, plan } = counting();
    const graph = instantiate(plan);
    const store = graph.resolve(StorePort);
    const directory: Directory = graph.resolve(DirectoryPort);
    expect(directory).toBe(store);
    store.put("x");
    expect(directory.ids()).toEqual(["x"]);
    expect(built.filter((name) => name === "store")).toEqual(["store"]);
  });

  it("the order of the bindings does not change the result", () => {
    const { plan } = counting();
    const reversed: Deployment<string> = {
      bindings: [...plan.bindings].reverse(),
      providedPorts: [],
      serves: [],
    };
    expect(instantiate(reversed).resolve(CounterPort).n).toBe(0);
  });

  it("two boots of the same deployment never see each other", () => {
    const { plan } = counting();
    instantiate(plan).resolve(StorePort).put("first");
    expect(instantiate(plan).resolve(StorePort).ids()).toEqual([]);
  });

  it("a cycle fails naming the whole cycle", () => {
    const APort = port("test.a")<Counter>();
    const BPort = port("test.b")<Counter>();
    const plan: Deployment<string> = {
      bindings: [
        bind(APort, { b: BPort }, ({ b }) => ({ n: b.n + 1 })),
        bind(BPort, { a: APort }, ({ a }) => ({ n: a.n + 1 })),
      ],
      providedPorts: [],
      serves: [],
    };
    expect(() => instantiate(plan).resolve(APort)).toThrow(
      "Cycle in the composition graph: test.a -> test.b -> test.a.",
    );
  });

  it("a component nobody provides fails naming it", () => {
    const plan: Deployment<string> = {
      bindings: [bind(CounterPort, { store: StorePort }, ({ store }) => ({ n: store.ids().length }))],
      providedPorts: [],
      serves: [],
    };
    expect(() => instantiate(plan).resolve(CounterPort)).toThrow(
      'No provider for "test.store" in this deployment.',
    );
  });

  it("resolveAll builds what nobody consumes, and fixes the creation order", () => {
    const { built, plan } = counting();
    const graph = instantiate(plan);
    graph.resolveAll();
    expect(built).toEqual(["clock", "store", "counter"]);
  });

  it("what knows how to close is collected in creation order, override included", () => {
    const closed: string[] = [];
    const plan: Deployment<string> = {
      bindings: [
        bind(ClosablePort, {}, () => ({ close: () => void closed.push("bound") })),
        bind(CounterPort, { closable: ClosablePort }, () => ({ n: 0 })),
      ],
      providedPorts: [],
      serves: [],
    };
    const graph = instantiate(plan, [replace(ClosablePort, { close: () => void closed.push("override") })]);
    graph.resolveAll();
    for (const closable of [...graph.closables].reverse()) void closable.close();
    expect(closed).toEqual(["override"]);
  });

  it("an override replaces the component before its builder runs", () => {
    const { built, plan } = counting();
    const graph = instantiate(plan, [replace(ClockPort, { now: () => 7 })]);
    graph.resolveAll();
    expect(built).not.toContain("clock");
    expect(graph.resolve(CounterPort).n).toBe(7);
    expect(graph.ports.map((p) => p.label)).toContain("test.clock");
  });

  // A replacement is of one component, not of a binding: whoever asks for the other view of an
  // instance still gets what the binding builds. A test that replaces a store replaces its
  // directory too, or it is looking at two different things.
  it("replacing one port of a binding leaves its other ports on the binding", () => {
    const { plan } = counting();
    const own = memoryStore();
    const graph = instantiate(plan, [replace(StorePort, own)]);
    expect(graph.resolve(StorePort)).toBe(own);
    expect(graph.resolve(DirectoryPort)).not.toBe(own);
  });

  it.each([
    [
      "operation",
      {
        handlers: {
          getHealth: {
            needs: {},
            useCase: { name: "getServiceHealth", build: () => undefined },
            controller: () => undefined,
          },
        },
      },
      'Two modules wire the operation "getHealth".',
    ],
    [
      "security scheme",
      { security: { ingestKey: { needs: {}, build: () => ({}) } } },
      'Two modules wire the security scheme "ingestKey".',
    ],
    ["CORS policy", { cors: { needs: {}, build: () => ({}) } }, "Two modules declare the CORS policy."],
  ])("two modules claiming one %s is a wiring error, not a silent override", (_what, serves, message) => {
    // The decoration is declared once, by a module of its own: what is claimed twice here is the
    // handler, the scheme or the policy.
    const decoration = { decoration: { needs: {}, build: () => ({ wrap: (useCase: unknown) => useCase }) } };
    const plan: Deployment<string> = {
      bindings: [],
      providedPorts: [],
      serves: [decoration, serves, serves],
    };
    expect(() => instantiate(plan).wire()).toThrow(message);
  });

  it("what a module serves is built with the components it named", () => {
    const plan: Deployment<string> = {
      bindings: [bind(StorePort, {}, memoryStore)],
      providedPorts: [],
      serves: [
        {
          security: {
            ingestKey: {
              needs: { store: StorePort },
              build: (...args: never[]) => {
                const [{ store }] = args as unknown as [{ store: Store }];
                store.put("served");
                return {};
              },
            },
          },
        },
      ],
    };
    const graph = instantiate(plan);
    graph.wire();
    expect(graph.resolve(StorePort).ids()).toEqual(["served"]);
  });
});
