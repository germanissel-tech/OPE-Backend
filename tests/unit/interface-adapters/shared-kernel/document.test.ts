// Feature 030: how a record travels into a durable store and comes back the same. It is a pure
// pair of functions, so it is tested here and not in `durability/` — nothing about it needs a
// restart, and the rule is that what passes without one belongs in `fast`.
//
// What matters is not that a date survives —every durability test already shows that— but
// **what else must not be mistaken for one**. The mark exists so that no guess is made from how a
// string looks; these are the objects that would be guessed wrong if the check said less.
import { describe, expect, it } from "vitest";
import { fromDocument, toDocument } from "../../../../src/interface-adapters/shared-kernel/document.js";

const roundTrip = (value: unknown): unknown => fromDocument(toDocument(value));

describe("a record written and read back", () => {
  it("brings an instant back as an instant, wherever it sits", () => {
    const at = new Date("2026-09-26T10:00:00.000Z");
    const back = roundTrip({ top: at, nested: { deep: at }, inList: [at] }) as {
      top: Date;
      nested: { deep: Date };
      inList: Date[];
    };
    expect(back.top).toBeInstanceOf(Date);
    expect(back.nested.deep).toBeInstanceOf(Date);
    expect(back.inList[0]).toBeInstanceOf(Date);
    expect(back.top.toISOString()).toBe(at.toISOString());
  });

  it("brings an instant back when it is the whole record, with no object around it", () => {
    // A `Date` at the root has no container to read the original off, so it is marked before the
    // walk starts. Without that, the root would come back the string JSON made of it.
    const at = new Date("2026-09-26T10:00:00.000Z");
    expect(roundTrip(at)).toBeInstanceOf(Date);
  });

  it("keeps everything that is not an instant exactly as it was", () => {
    const record = {
      text: "2026-09-26T10:00:00.000Z",
      number: 1,
      flag: false,
      list: [1, "two", { three: 3 }],
      nested: { a: { b: "c" } },
    };
    // The string here is a valid ISO instant and must stay a string: nothing is decided by how a
    // value looks, which is the whole reason the instants are marked.
    expect(roundTrip(record)).toEqual(record);
  });

  it("carries a null through instead of choking on it", () => {
    // `typeof null` is `"object"`, so a check that forgets null reaches `Object.keys(null)` and
    // throws — on any record with an absent value, which is most of them.
    expect(roundTrip({ absent: null, list: [null] })).toEqual({ absent: null, list: [null] });
  });
});

describe("what must not be mistaken for an instant", () => {
  const notAMark = (value: unknown): unknown => (roundTrip({ held: value }) as { held: unknown }).held;

  it("an object whose single field holds a number, not a string", () => {
    // `{"$date": 1}` is not a mark: the value of a mark is the ISO text of an instant.
    expect(notAMark({ $date: 1 })).toEqual({ $date: 1 });
  });

  it("an object that carries the mark among other fields", () => {
    // Two fields means it is a record of the domain that happens to have that name, not a mark.
    expect(notAMark({ $date: "2026-09-26T10:00:00.000Z", other: 1 })).toEqual({
      $date: "2026-09-26T10:00:00.000Z",
      other: 1,
    });
  });

  it("an object with a single field that is not the mark", () => {
    // The one the ledger actually carries: `evidence: { truth: "known" }`. If a single-field
    // object were read as an instant, every decision would come back with its evidence replaced
    // by an invalid date, and nothing would say so.
    expect(notAMark({ truth: "known" })).toEqual({ truth: "known" });
  });

  it("a list holding a single string", () => {
    expect(notAMark(["2026-09-26T10:00:00.000Z"])).toEqual(["2026-09-26T10:00:00.000Z"]);
  });
});
