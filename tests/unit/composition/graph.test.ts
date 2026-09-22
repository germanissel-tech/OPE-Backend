// Feature 020, US1 (FR-004..FR-007; ADR-033): the graph of one boot. What the compiler cannot
// state —identity of a derived view, one instance per boot, order that does not matter, a cycle
// that names itself, the creation order the shutdown reverses— is stated here. What it can state
// lives in tests/typecheck/fixtures/graph-*.ts.
import { describe, expect, it } from "vitest";
import {
  bind,
  derive,
  instantiate,
  port,
  replace,
  type Deployment,
  type Serves,
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
      bind(ClockPort, [], () => {
        built.push("clock");
        return { now: () => 0 };
      }),
      bind(StorePort, [], () => {
        built.push("store");
        return memoryStore();
      }),
      derive(DirectoryPort, StorePort),
      bind(CounterPort, [StorePort, ClockPort], (store, clock) => {
        built.push("counter");
        return { n: store.ids().length + clock.now() };
      }),
    ],
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

  it("a derived view is the very object of its source, not a copy", () => {
    const graph = instantiate(counting().plan);
    const store = graph.resolve(StorePort);
    const directory: Directory = graph.resolve(DirectoryPort);
    expect(directory).toBe(store);
    store.put("x");
    expect(directory.ids()).toEqual(["x"]);
  });

  it("the order of the bindings does not change the result", () => {
    const { plan } = counting();
    const reversed: Deployment<string> = { bindings: [...plan.bindings].reverse(), serves: [] };
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
        bind(APort, [BPort], (b) => ({ n: b.n + 1 })),
        bind(BPort, [APort], (a) => ({ n: a.n + 1 })),
      ],
      serves: [],
    };
    expect(() => instantiate(plan).resolve(APort)).toThrow(
      "Cycle in the composition graph: test.a -> test.b -> test.a.",
    );
  });

  it("a component nobody provides fails naming it", () => {
    const plan: Deployment<string> = { bindings: [derive(DirectoryPort, StorePort)], serves: [] };
    expect(() => instantiate(plan).resolve(DirectoryPort)).toThrow(
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
        bind(ClosablePort, [], () => ({ close: () => void closed.push("bound") })),
        bind(CounterPort, [ClosablePort], () => ({ n: 0 })),
      ],
      serves: [],
    };
    const graph = instantiate(plan, [replace(ClosablePort, { close: () => void closed.push("override") })]);
    graph.resolveAll();
    for (const closable of [...graph.closables].reverse()) void closable.close();
    expect(closed).toEqual(["override"]);
  });

  it("an override replaces the component before its builder runs", () => {
    const { built, plan } = counting();
    const graph = instantiate(plan, [replace(StorePort, memoryStore())]);
    graph.resolveAll();
    expect(built).not.toContain("store");
    expect(graph.ports.map((p) => p.label)).toContain("test.store");
  });

  it("two modules claiming one security scheme is a wiring error", () => {
    const scheme: Serves = {
      security: { ingestKey: { deps: [], build: () => ({}) } },
    };
    const plan: Deployment<string> = { bindings: [], serves: [scheme, scheme] };
    expect(() => instantiate(plan).wire()).toThrow('Two modules wire the security scheme "ingestKey".');
  });

  it("what a module serves is built with the components it named", () => {
    const plan: Deployment<string> = {
      bindings: [bind(StorePort, [], memoryStore)],
      serves: [
        {
          security: {
            ingestKey: {
              deps: [StorePort],
              build: (...args: never[]) => {
                const [store] = args as unknown as [Store];
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
