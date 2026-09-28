// The in-memory register against the shared contract. The durable one runs the same file from
// `tests/durability/`, which is what keeps the two from behaving differently by deployment.
import { describe } from "vitest";
import { memoryEventLog } from "../../../../src/interface-adapters/ingestion/index.js";
import { anEventLog } from "./event-log.contract.js";

describe("memoryEventLog", () => {
  // Nothing is deferred in memory, so settling is a no-op — and saying so here is what lets the
  // contract be written once for an implementation that queues and one that does not.
  anEventLog(() => ({ log: memoryEventLog(), settle: () => Promise.resolve() }));
});
