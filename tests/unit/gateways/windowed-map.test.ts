// Feature 015 (F-033): the bounded window per merchant the in-memory gateways share, written
// once — TTL from the last touch, a size cap that drops the least recently touched, one Map per
// merchant.
import { describe, expect, it } from "vitest";
import { asMerchantId } from "../../../src/domain/shared-kernel/index.js";
import { windowedByMerchant } from "../../../src/interface-adapters/gateways/shared-kernel/windowed-map.js";

const A = asMerchantId("m_a");
const B = asMerchantId("m_b");
const TTL = 1000;

const windowOf = (max: number) => windowedByMerchant<string, number>({ ttlMs: TTL, max }, (at) => at);

describe("windowedByMerchant", () => {
  it("returns what was saved, and nothing for a key never saved", () => {
    const w = windowOf(10);
    w.save(A, "k", 5);
    expect(w.load(A, "k", 5)).toBe(5);
    expect(w.load(A, "other", 5)).toBeUndefined();
  });

  it("TTL: an entry leaves once the window has passed since its touch, not a millisecond before", () => {
    const w = windowOf(10);
    w.save(A, "k", 0);
    expect(w.load(A, "k", TTL - 1)).toBe(0);
    expect(w.load(A, "k", TTL)).toBeUndefined();
  });

  it("cap: past the window's size the least recently touched entries leave first", () => {
    const w = windowOf(2);
    w.save(A, "one", 0);
    w.save(A, "two", 0);
    w.save(A, "three", 0);
    expect(w.load(A, "one", 0)).toBeUndefined();
    expect(w.load(A, "two", 0)).toBe(0);
    expect(w.load(A, "three", 0)).toBe(0);
  });

  it("order by last touch: saving an existing key again makes it the most recent", () => {
    const w = windowOf(2);
    w.save(A, "one", 0);
    w.save(A, "two", 0);
    w.save(A, "one", 1);
    w.save(A, "three", 1);
    expect(w.load(A, "two", 1)).toBeUndefined();
    expect(w.load(A, "one", 1)).toBe(1);
  });

  it("a sweep stops at the first entry still inside the window: a refreshed entry protects nothing behind it", () => {
    const w = windowOf(10);
    w.save(A, "old", 0);
    w.save(A, "fresh", TTL);
    expect(w.load(A, "old", TTL)).toBeUndefined();
    expect(w.load(A, "fresh", TTL)).toBe(TTL);
  });

  it("one Map per merchant: keys, caps and sweeps never cross", () => {
    const w = windowOf(1);
    w.save(A, "k", 0);
    w.save(B, "k", 0);
    w.save(B, "other", 0);
    expect(w.load(A, "k", 0)).toBe(0);
    expect(w.load(B, "k", 0)).toBeUndefined();
    expect(w.load(B, "other", 0)).toBe(0);
  });
});
