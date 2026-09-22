// Fixture (feature 020, FR-003): a technology table that does not serve one of the ports its
// module declares does not compile, and the message names the port.
import { bind, port, technology } from "../../../src/composition/graph/index.js";

const StorePort = port("test.store")<{ ids: () => string[] }>();
const DirectoryPort = port("test.directory")<{ ids: () => string[] }>();

export const partial = technology(
  [StorePort, DirectoryPort],
  [bind(StorePort, [], () => ({ ids: () => [] }))],
);
