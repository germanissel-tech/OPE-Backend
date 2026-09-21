// The bounded window per merchant the in-memory gateways share, written once (audit 014
// F-033): a Map per merchant — they never cross — whose entries leave when the window's TTL has
// passed since they were last touched, or when the merchant holds more than the window admits,
// the least recently touched first. Map preserves insertion order, so the first entry is the
// oldest; a save re-inserts the key, which moves it to the most recent position. The cap is
// enforced where entries enter (a save); a sweep on load only expires by time.
import type { MerchantId } from "../../domain/shared-kernel/index.js";

export interface BoundedWindow {
  readonly ttlMs: number;
  /** Entries a merchant may hold at once. */
  readonly max: number;
}

export interface WindowedByMerchant<K, V> {
  /** The value under `key` for the merchant, after sweeping what the window no longer admits as of `now`. */
  load(merchantId: MerchantId, key: K, now: number): V | undefined;
  /** Stores the value as the merchant's most recent entry and trims the merchant to the window's size. */
  save(merchantId: MerchantId, key: K, value: V): void;
}

/** `touchedAt` reads, from a stored value, the instant (epoch ms) the TTL counts from. */
export function windowedByMerchant<K, V>(
  window: BoundedWindow,
  touchedAt: (value: V) => number,
): WindowedByMerchant<K, V> {
  const byMerchant = new Map<MerchantId, Map<K, V>>();

  const bucket = (merchantId: MerchantId): Map<K, V> => {
    let entries = byMerchant.get(merchantId);
    if (!entries) {
      entries = new Map();
      byMerchant.set(merchantId, entries);
    }
    return entries;
  };

  const trim = (entries: Map<K, V>): void => {
    while (entries.size > window.max) {
      const oldest = entries.keys().next();
      if (oldest.done) break;
      entries.delete(oldest.value);
    }
  };

  const sweep = (entries: Map<K, V>, now: number): void => {
    for (const [key, value] of entries) {
      if (now - touchedAt(value) < window.ttlMs) break;
      entries.delete(key);
    }
  };

  return {
    load(merchantId, key, now) {
      const entries = bucket(merchantId);
      sweep(entries, now);
      return entries.get(key);
    },
    save(merchantId, key, value) {
      const entries = bucket(merchantId);
      entries.delete(key);
      entries.set(key, value);
      trim(entries);
    },
  };
}
