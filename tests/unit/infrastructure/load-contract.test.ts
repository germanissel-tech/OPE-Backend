// Feature 004 — FR-040: the server is governed by the bundled contract; a missing bundle is a clear error that
// keeps the original cause, not a YAML parse of nothing.
import { describe, expect, it } from "vitest";
import { loadContract } from "../../../src/infrastructure/http/load-contract.js";

describe("loadContract", () => {
  it("parses the real bundle", () => {
    const definition = loadContract("contracts/dist/openapi.yaml");
    expect(definition.openapi).toBe("3.1.0");
    expect(definition.paths?.["/v1/health"]?.get?.operationId).toBe("getHealth");
  });

  it("a bundle that cannot be read fails with the file, the fix and the cause", () => {
    let caught: unknown;
    try {
      loadContract("contracts/dist/nope.yaml");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const error = caught as Error;
    expect(error.message).toBe(
      "Bundled contract contracts/dist/nope.yaml cannot be read. Run npm run contract:bundle.",
    );
    expect(error.cause).toBeInstanceOf(Error);
    expect((error.cause as NodeJS.ErrnoException).code).toBe("ENOENT");
  });
});
