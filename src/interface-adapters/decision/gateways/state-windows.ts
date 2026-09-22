// The windows of the state the decision plane keeps in memory (level 1 of the configuration,
// constitution XI): how long a session and a visitor are remembered, and how many of each an
// instance keeps. They take the values, not the configuration entity: a gateway of this module
// knows nothing of the configuration module.
import type { SessionWindow, VisitorWindow } from "../../../application/decision/index.js";

export function sessionWindowOf(ttlMs: number, maxSessions: number): SessionWindow {
  return { ttlMs, maxSessions };
}

export function visitorWindowOf(ttlMs: number, maxVisitors: number): VisitorWindow {
  return { ttlMs, maxVisitors };
}
