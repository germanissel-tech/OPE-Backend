// The deduplication window of level 1 (constitution XI), as a reader of its two numbers (feature 036).
//
// It takes readers and not values, like the windows of the decision plane: the ids a merchant keeps and how
// long they last are configuration, so a version published while the server runs is obeyed from the next
// batch on. The fields are getters because whoever holds the window asks it on every claim.
import type { DedupWindow } from "../../../application/ingestion/index.js";

export function dedupWindowOf(ttlMs: () => number, maxIds: () => number): DedupWindow {
  return {
    get ttlMs() {
      return ttlMs();
    },
    get maxIds() {
      return maxIds();
    },
  };
}
