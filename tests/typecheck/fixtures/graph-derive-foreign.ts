// Fixture (feature 020, FR-007): a view derived from an instance that does not satisfy it does not
// compile. Two views of one component are one instance, or they are not a derivation.
import { derive, port } from "../../../src/composition/graph/index.js";

const ClockPort = port("test.clock")<{ now: () => Date }>();
const DirectoryPort = port("test.directory")<{ ids: () => string[] }>();

export const foreign = derive(DirectoryPort, ClockPort);
