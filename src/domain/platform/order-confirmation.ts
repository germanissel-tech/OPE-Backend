// What makes an order brought by `pull` or `subscribe` a confirmed one (ADR-047; documentary verification,
// point 5): the states of the merchant's platform it accepts, as the platform spells them. By `push` the
// platform already decides what it sends, so the rule only acts on what OPE reads.
import { fail, ok, type Result } from "../shared-kernel/index.js";
import { InvalidOrderConfirmation } from "./errors.js";

export class OrderConfirmation {
  readonly states: readonly string[];

  private constructor(states: readonly string[]) {
    this.states = [...states];
  }

  /** Every state named once and not blank; the list may be empty, and then nothing read is confirmed. */
  static of(states: readonly string[]): Result<OrderConfirmation, InvalidOrderConfirmation> {
    const blank = states.findIndex((state) => state.trim() === "");
    if (blank >= 0) return fail(new InvalidOrderConfirmation(`[${blank}]`, "must not be blank"));
    const repeated = states.findIndex((state, i) => states.indexOf(state) !== i);
    if (repeated >= 0) return fail(new InvalidOrderConfirmation(`[${repeated}]`, "must not repeat"));
    return ok(new OrderConfirmation(states));
  }

  static rehydrate(states: readonly string[]): OrderConfirmation {
    return new OrderConfirmation(states);
  }

  /** Whether an order in this state of the platform counts as confirmed; the comparison is exact. */
  confirms(state: string): boolean {
    return this.states.includes(state);
  }

  /** Whether no state is accepted: what a merchant that pulls or subscribes to its orders cannot publish. */
  acceptsNone(): boolean {
    return this.states.length === 0;
  }
}
