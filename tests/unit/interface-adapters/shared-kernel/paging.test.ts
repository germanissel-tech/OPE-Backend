// The paging of a durable read (feature 033): the cursor is the **key** of the last row served and not
// a position in a list, because these tables are append-only and a position names a different row as
// soon as anything is appended.
//
// It is tested here and not only through a gateway because the three cases that decide whether the
// cursor is honest are cheap to state and invisible in a store: a cursor that is not a key, a page that
// exactly exhausts the rows, and a page of more than two — where "the last one" and "the second one"
// stop being the same row. The mutation gate found all three (US2 of feature 033).
import { describe, expect, it } from "vitest";
import { descending, pageTo } from "../../../../src/interface-adapters/shared-kernel/index.js";

/** Rows as a store hands them back: newest first, keyed by what the cursor will carry. */
const rowsOf = (...keys: readonly number[]) => keys.map((key) => ({ key, item: `row-${String(key)}` }));

describe("descending", () => {
  it("asks for one row more than the page carries, which is what tells it there is a next page", () => {
    expect(descending({ limit: 2 })).toMatchObject({ limit: 3, size: 2 });
  });

  it("starts above every key when the cursor is absent, malformed or not a key", () => {
    // A key of these tables is positive, so the first page is "below the largest integer there is".
    // Taking the cursor at face value would turn each of these into `WHERE id < NaN`, which is an
    // empty page: the reader would be told the collection is empty rather than shown its first page.
    for (const cursor of [undefined, "", "nonsense", "0", "-1", "1.5"]) {
      expect(descending({ limit: 2, cursor }).below).toBe(Number.MAX_SAFE_INTEGER);
    }
  });

  it("resumes below the key the cursor names", () => {
    expect(descending({ limit: 2, cursor: "7" }).below).toBe(7);
  });

  it("caps what it serves, whatever the caller asked for", () => {
    expect(descending({ limit: 10_000 }).size).toBe(200);
    expect(descending({ limit: 0 }).size).toBe(1);
  });
});

describe("pageTo", () => {
  it("serves the page and names the last row served as the cursor", () => {
    // Three and not two: with two, the last row and the second one are the same row, and a cursor
    // that named the second would be indistinguishable from one that names the last.
    const window = descending({ limit: 3 });
    expect(pageTo(rowsOf(9, 8, 7, 6), window)).toEqual({
      items: ["row-9", "row-8", "row-7"],
      nextCursor: "7",
    });
  });

  it("gives no cursor when the rows the store answered are exactly the page", () => {
    // The boundary that matters: the statement asked for one more and got none, so this is the end.
    // A cursor here would lead to an empty page, and the reader would ask for it.
    expect(pageTo(rowsOf(9, 8), descending({ limit: 2 }))).toEqual({ items: ["row-9", "row-8"] });
  });

  it("gives no cursor for a page that is not even full, and none for an empty one", () => {
    expect(pageTo(rowsOf(9), descending({ limit: 2 }))).toEqual({ items: ["row-9"] });
    expect(pageTo([], descending({ limit: 2 }))).toEqual({ items: [] });
  });
});
