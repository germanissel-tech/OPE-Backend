// What every durable gateway shares (features 030 and 034): how a refused write becomes a value, and
// **when the turn is waited for**.
//
// The turn is here and not in each gateway because the three wrappers of this ring funnel into one
// function, so this file is where "every write of every durable gateway waits" is asserted once. What it
// cannot assert is that the turn *means* something — that is the store's behaviour and lives in
// `tests/durability/unit-of-work.test.ts`, against a real one.
import { describe, expect, it } from "vitest";
import { attempted } from "../../../../src/interface-adapters/ledger/index.js";
import { fetched, stored, tried } from "../../../../src/interface-adapters/shared-kernel/index.js";
import { fakeLogger, fakeStore } from "../../../helpers/sql-store.js";
import type { DomainError } from "../../../../src/domain/shared-kernel/index.js";

/** A write, shaped so it returns nothing: what every port of ADR-021 hands these wrappers. */
const writing = (store: { run: (sql: string) => void }) => (): undefined => {
  store.run("INSERT INTO admin_entries DEFAULT VALUES");
  return undefined;
};

const subject = (options: { refuses?: boolean } = {}) => {
  const fake = fakeStore(options);
  const recorder = fakeLogger();
  return { deps: { store: fake.store, logger: recorder.logger }, fake, logged: recorder.entries };
};

describe("the write wrappers of a durable gateway", () => {
  it("waits its turn before touching the store, whichever wrapper is used", async () => {
    // The three of them, because what makes the guarantee of feature 034 hold is that **no** write path
    // skips it: one that did would land inside somebody else's open transaction.
    const { deps, fake } = subject();

    await stored(deps, "merchant", writing(deps.store));
    await attempted(deps, "decision", writing(deps.store));
    await tried(
      deps,
      "whatever",
      writing(deps.store),
      () => ({ code: "store-unavailable", module: "shared-kernel" }) as unknown as DomainError,
    );

    expect(fake.turns()).toBe(3);
  });

  it("waits its turn before a read, and gives back what the read answered", async () => {
    const { deps, fake } = subject({});

    const answer = await fetched(deps, () => "what the gateway parsed");

    expect(answer).toBe("what the gateway parsed");
    expect(fake.turns()).toBe(1);
  });

  it("still turns a refused write into the failure its port declares, and logs the cause", async () => {
    // The behaviour of feature 030, unchanged: what the turn added must not have moved the failure
    // channel, because that is what lets the decision plane fail closed (ADR-021).
    const { deps, logged } = subject({ refuses: true });

    const refused = await stored(deps, "merchant", writing(deps.store));

    expect(refused.ok).toBe(false);
    expect(refused.ok ? undefined : refused.error.code).toBe("store-unavailable");
    expect(logged).toHaveLength(1);
    expect(logged[0]?.fields).toMatchObject({ write: "merchant" });
  });

  it("names the ledger's own failure when the ledger is what refused", async () => {
    // Two names for the same fact on purpose: an operator reading a log tells a degraded decision from a
    // refused administration action by this, and nothing else.
    const { deps } = subject({ refuses: true });

    const refused = await attempted(deps, "decision", writing(deps.store));

    expect(refused.ok ? undefined : refused.error.code).toBe("ledger-unavailable");
  });
});
