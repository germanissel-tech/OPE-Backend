// ADR-013 (amendment): a profile composes one binding table per module. The binder takes the
// override before building, never builds what an override replaces, and records what it built
// (and the overrides it adopted) in creation order for shutdown.
import { describe, expect, it } from "vitest";
import { binder } from "../../../src/composition/profile.js";
import type { Clock, IdGenerator } from "../../../src/application/shared-kernel/index.js";

const closableClock = (name: string, closed: string[]): Clock & { close(): void } => ({
  now: () => new Date(0),
  close: () => closed.push(name),
});
const ids: IdGenerator = { decisionId: () => "dec_x" as never };

describe("binder", () => {
  it("builds every port of a table through its factory, once, in key order", () => {
    const calls: string[] = [];
    const { bind } = binder({});
    const built = bind({
      clock: () => (calls.push("clock"), closableClock("c", [])),
      ids: () => (calls.push("ids"), ids),
    });
    expect(Object.keys(built)).toEqual(["clock", "ids"]);
    expect(built.ids).toBe(ids);
    expect(calls).toEqual(["clock", "ids"]);
  });

  it("an override replaces the port and its factory is never called", () => {
    const override = closableClock("override", []);
    const { bind } = binder({ clock: override });
    const built = bind({
      clock: () => {
        throw new Error("built despite the override");
      },
      ids: () => ids,
    });
    expect(built.clock).toBe(override);
  });

  it("records closable ports, built or overridden, in creation order across tables", () => {
    const closed: string[] = [];
    const { bind, closables } = binder({ ids: { ...ids, close: () => closed.push("ids") } as never });
    bind({ clock: () => closableClock("clock", closed), ids: () => ids });
    bind({
      decisions: () =>
        ({ record: () => undefined, find: () => undefined, close: () => closed.push("decisions") }) as never,
    });
    for (const c of [...closables].reverse()) void c.close();
    expect(closed).toEqual(["decisions", "ids", "clock"]);
  });

  it("a port without close() is built but not tracked", () => {
    const { bind, closables } = binder({});
    bind({ ids: () => ids });
    expect(closables).toEqual([]);
  });
});
