// How long the decision plane keeps a session in memory (feature 032). It is a value
// of the **environment** by the same argument as `event-log-config.ts`, and it is worth saying why
// here because until this feature it was not: this number used to be `sessionWindowMs` of level 1,
// where it meant two things at once — the duration of a session, which the SDK obeys and a merchant
// therefore observes, and how long the backend remembers it, which nobody observes.
//
// Splitting them is what makes this side environment. Once a forgotten session is rebuilt from what
// is durable (FR-004), evicting it changes no answer: the plane reads the same interventions and
// reaches the same verdict, only slower. What the number tunes is how much memory an instance holds,
// which describes the machine and not the product.
//
// And the same consequence settled it: level 1 is published to the SDK inside `EffectiveConfiguration`,
// whose schema admits no extra property. A retention in level 1 would have to be added to the
// contract, telling every merchant how big our cache is.
import { whole } from "./env.js";
import type { Variable } from "./config-error.js";

const SESSION_VARIABLE = "OPE_SESSION_RETENTION_MS" satisfies Variable;

/**
 * A day when nothing says otherwise, which is what the single field used to hold and what the
 * behaviour of the server is measured against today. It is a starting point and not a measurement:
 * the number that matters is the one the memory of a pilot produces.
 */
const DEFAULT_RETENTION_MS = 86_400_000;

export interface StateRetention {
  /** How long a session stays in memory before it has to be rebuilt from what is durable. */
  readonly sessionMs: number;
}

export function readStateRetention(env: NodeJS.ProcessEnv): StateRetention {
  return {
    sessionMs: whole(env, SESSION_VARIABLE, DEFAULT_RETENTION_MS),
  };
}
