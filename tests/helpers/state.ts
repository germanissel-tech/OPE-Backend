// What a state store answered, for a test that asks a **port** directly (feature 032). Since the two
// state stores gained a failure channel, `load` returns a `Result`: `stateOf` is the one place that
// unwraps it, so a test keeps asserting on the state and a read that failed does not quietly become
// "this visitor is new" — which is the very confusion the failure channel exists to prevent.
import type { Recalled } from "../../src/application/decision/index.js";

export function stateOf<T>(answer: Recalled<T>): T | undefined {
  if (!answer.ok) throw new Error(`the store could not answer: ${answer.error.message}`);
  return answer.value;
}
