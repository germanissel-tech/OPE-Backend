// The windows of the state the decision plane keeps in memory (level 1 of the configuration,
// constitution XI): how long a session and a visitor are remembered, and how many of each an
// instance keeps. They take **readers** of the values, not the configuration entity: a gateway of this
// module knows nothing of the configuration module.
//
// **The two fields are getters and that is the point** (feature 036): the stores read `ttlMs` on every
// eviction, so a window published while the server runs is obeyed from the next read on. Copying the
// numbers here would turn a configured value back into a constant of the process, which is the defect this
// story closes.
import type { SessionWindow, VisitorWindow } from "../../../application/decision/index.js";

export function sessionWindowOf(ttlMs: () => number, maxSessions: () => number): SessionWindow {
  return {
    get ttlMs() {
      return ttlMs();
    },
    get maxSessions() {
      return maxSessions();
    },
  };
}

export function visitorWindowOf(ttlMs: () => number, maxVisitors: () => number): VisitorWindow {
  return {
    get ttlMs() {
      return ttlMs();
    },
    get maxVisitors() {
      return maxVisitors();
    },
  };
}
