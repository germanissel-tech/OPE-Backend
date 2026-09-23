// Fixture (feature 020, FR-007): one instance behind several ports has to satisfy all of them.
// A value that does not satisfy one of the views does not compile.
import { bindAll, port } from "../../../src/composition/graph/index.js";

const ClockPort = port("test.clock")<{ now: () => Date }>();
const DirectoryPort = port("test.directory")<{ ids: () => string[] }>();

export const mismatched = bindAll([DirectoryPort, ClockPort], {}, () => ({ ids: () => [] }));
