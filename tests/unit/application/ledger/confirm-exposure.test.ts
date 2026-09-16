// US4 (FR-031, FR-052): invariantes de la exposición. Se completa en la historia 4.
import { describe, it } from "vitest";

describe("confirmExposure", () => {
  it.todo("[invariant:exposure-decision-unknown] decisión inexistente o de otro merchant → rechazada");
  it.todo("[invariant:exposure-of-no-op] decisión NO_OP → rechazada");
});
