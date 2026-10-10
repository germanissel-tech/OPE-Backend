// The witness at the edge (feature 043, ADR-046): `If-Match` carries the witness a read handed out, and
// `ETag` hands it out. Only one strong tag is a witness; anything else must never match one, so a write
// that sends it is refused as stale instead of slipping through.
import { describe, expect, it } from "vitest";
import { etagOf, witnessIn, witnessOf } from "../../../../src/interface-adapters/http/boundary.js";

describe("the witness at the edge", () => {
  it("a single strong tag is its value, and etagOf quotes it back", () => {
    expect(witnessOf('"platform-12"')).toBe("platform-12");
    expect(witnessOf(etagOf("m_a:7"))).toBe("m_a:7");
    expect(etagOf("m_a:7")).toBe('"m_a:7"');
  });

  it("the wildcard, several tags, a weak one or an unquoted one match no witness", () => {
    const witnesses = ["platform-12", "m_a:7", "*", ""];
    for (const header of ["*", '"platform-12", "m_a:7"', 'W/"platform-12"', "platform-12", '""', '"']) {
      expect(witnesses).not.toContain(witnessOf(header));
    }
  });
});

describe("the witness of a request", () => {
  it("is read from If-Match whatever the case of its name", () => {
    expect(witnessIn({ "if-match": '"platform-3"' })).toBe("platform-3");
    expect(witnessIn({ "If-Match": '"platform-3"' })).toBe("platform-3");
    expect(witnessIn({})).not.toBe("");
  });
});
