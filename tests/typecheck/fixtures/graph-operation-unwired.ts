// Fixture (feature 020, FR-013): a deployment whose modules do not cover every operation the
// contract declares does not compile. What the boot checks against the contract file it loads, the
// compiler checks against the types the contract generates.
import { bind, compositionModule, deployment, port } from "../../../src/composition/graph/index.js";

const StorePort = port("test.store")<{ ids: () => string[] }>();

const store = compositionModule({
  provides: { memory: [bind(StorePort, {}, () => ({ ids: () => [] }))] },
});

export const nothingServed = deployment([store]);
