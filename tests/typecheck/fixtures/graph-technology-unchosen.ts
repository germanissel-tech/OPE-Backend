// Fixture (feature 020, FR-002): a module that can be served in more than one way does not enter
// a deployment without saying which; with a single technology there is nothing to choose.
import { bind, compositionModule, deployment, port } from "../../../src/composition/graph/index.js";

const StorePort = port("test.store")<{ ids: () => string[] }>();

const store = compositionModule({
  provides: {
    memory: [bind(StorePort, {}, () => ({ ids: () => [] }))],
    postgres: [bind(StorePort, {}, () => ({ ids: () => [] }))],
  },
});

export const unchosen = deployment([store]);
