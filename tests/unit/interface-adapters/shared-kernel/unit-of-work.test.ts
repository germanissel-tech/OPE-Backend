// The two implementations of `UnitOfWork` (feature 034, ADR-042), each against a double.
//
// **This file exists because the quickstart of the feature asked for it and nobody had written it.** The
// mechanism is tested where it lives —`tests/durability/unit-of-work.test.ts`, against a real store,
// because everything it promises is about what survives a failure— and the two adapters here were covered
// only sideways, by the integration suite. What is pinned here is the part that has no equivalent
// anywhere: which of the two a deployment gets, and that the one which **cannot revert** still says so.
import { describe, expect, it } from "vitest";
import {
  durableUnitOfWork,
  transientUnitOfWork,
} from "../../../../src/interface-adapters/shared-kernel/index.js";
import { fakeStore } from "../../../helpers/sql-store.js";

describe("durableUnitOfWork", () => {
  it("hands the work to the store, which is all it does", async () => {
    // Two lines of adapter and no logic: the turn, the transaction and the guard are the store's
    // (ADR-013). What this asserts is that nothing else got in between.
    const fake = fakeStore();
    const unit = durableUnitOfWork(fake.store);

    const outcome = await unit.scope(async () => "the work ran");

    expect(outcome).toEqual({ ok: true, value: "the work ran" });
  });
});

describe("transientUnitOfWork", () => {
  it("runs the work and answers its value when nobody aborted", async () => {
    const outcome = await transientUnitOfWork().scope(async () => 7);

    expect(outcome).toEqual({ ok: true, value: 7 });
  });

  it("reports the abort as the failure of the unit, although it cannot revert", async () => {
    // **The half that is not optional.** The first version answered `ok` whatever happened, and creating a
    // merchant with a refusing trail answered `201`: the caller was told the action succeeded when nothing
    // had audited it, which is the one thing the amendment of ADR-034 exists to prevent. "Cannot revert"
    // must not become "cannot tell".
    let ran = false;
    const outcome = await transientUnitOfWork().scope(async (abort) => {
      abort();
      ran = true;
      return "what the work returned";
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.ok ? undefined : outcome.error.code).toBe("store-unavailable");
    // And the work did finish: this deployment reports the abort, it does not interrupt anything.
    expect(ran).toBe(true);
  });

  it("answers the failure even when the abort comes before anything else", async () => {
    // The order does not matter, which is what says the answer is decided by the abort and not by where
    // in the work it happened.
    const outcome = await transientUnitOfWork().scope(async (abort) => {
      const first = "written before the abort";
      abort();
      return first;
    });

    expect(outcome.ok).toBe(false);
  });
});
