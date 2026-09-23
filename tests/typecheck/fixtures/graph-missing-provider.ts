// Fixture (feature 020, FR-002): a deployment where nobody provides what a binding needs does not
// compile, and the message names the component that is missing.
import { bind, compositionModule, deployment, port } from "../../../src/composition/graph/index.js";

const ClockPort = port("test.clock")<{ now: () => Date }>();
const StorePort = port("test.store")<{ ids: () => string[] }>();

const store = compositionModule({
  provides: [bind(StorePort, { clock: ClockPort }, () => ({ ids: () => [] }))],
});

export const incomplete = deployment([store]);
