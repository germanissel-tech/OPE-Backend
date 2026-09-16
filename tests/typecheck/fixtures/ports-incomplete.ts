// Fixture (feature 004, FR-003): un perfil que omite un puerto del contenedor no compila (TS2741).
import type { Ports } from "../../../src/composition/ports.js";

export const incomplete: Ports = {
  clock: { now: () => new Date() },
};
