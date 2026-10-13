// The decisions of a visitor, one at a time (feature 046; D-30). A decision reads how many interventions the
// session and the visitor already have, judges them against the caps of the commercial policy, records the
// decision and remembers the new count, with waits in between: two batches of the same visitor that overlap would
// both read the old count and both intervene. So the decisions of a visitor of a merchant queue behind each other,
// and the decisions of other visitors do not wait at all.
//
// A decorator of the port and not a change of the service: the service decides and knows nothing of concurrency,
// as the logged and the gated use cases do not make the use case know of the log or the mode. In the process,
// because what is consumed is a count in memory and a serialised write on the decision path is what principle IV
// does not admit (ADR-041); with two processes it takes something else, and that is D-21.
//
// Today the race is latent: with the stores of this repository every wait inside a decision resolves within the
// same turn of the event loop, so a decision runs whole before the next request is read. It becomes real the
// moment reading the state really waits, as with a remote store; the tests of the caps run against one.
import type { Decision } from "../../../domain/ledger/index.js";
import type { DecisionPlane, DecisionRequest } from "../../ingestion/index.js";

export class VisitorTurns implements DecisionPlane {
  readonly #inner: DecisionPlane;
  /**
   * The last decision queued for each visitor, settled whatever its outcome: what the next one waits for. A visitor
   * is here only while it has a decision in course or waiting.
   */
  readonly #last = new Map<string, Promise<void>>();

  constructor(inner: DecisionPlane) {
    this.#inner = inner;
  }

  async decide(request: DecisionRequest): Promise<Decision> {
    // JSON so that no merchant and visitor can make the key of another pair.
    const key = JSON.stringify([request.merchantId, request.batch.visitorId]);
    const before = this.#last.get(key) ?? Promise.resolve();
    // Behind the one before, **settled**: a decision that failed releases the turn as one that worked does.
    const mine = before.then(() => this.#inner.decide(request));
    const settled = mine.then(
      () => undefined,
      () => undefined,
    );
    this.#last.set(key, settled);
    try {
      return await mine;
    } finally {
      // Forgotten only by the last of the queue: one that came after it is still the one the next waits for.
      if (this.#last.get(key) === settled) this.#last.delete(key);
    }
  }

  /** How many visitors have a decision in course or waiting; none once every decision ended. */
  visitorsInCourse(): number {
    return this.#last.size;
  }
}
