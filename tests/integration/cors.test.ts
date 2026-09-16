// US5 (FR-040; ADR-014): orígenes por merchant. Se completa en la historia 5.
import { describe, it } from "vitest";

describe("orígenes por merchant", () => {
  it.todo("[invariant:origin-not-allowed] clave de un merchant con Origin de otro → 403");
});
