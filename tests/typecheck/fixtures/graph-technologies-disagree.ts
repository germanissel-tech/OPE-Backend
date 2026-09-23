// Fixture (feature 020, FR-003): the technologies of a module have to provide the same
// components. One that leaves a port out does not compile, and the message names the port.
import { bind, compositionModule, port } from "../../../src/composition/graph/index.js";

const StorePort = port("test.store")<{ ids: () => string[] }>();
const DirectoryPort = port("test.directory")<{ ids: () => string[] }>();

export const partial = compositionModule({
  provides: {
    memory: [
      bind(StorePort, {}, () => ({ ids: () => [] })),
      bind(DirectoryPort, {}, () => ({ ids: () => [] })),
    ],
    postgres: [bind(StorePort, {}, () => ({ ids: () => [] }))],
  },
});
