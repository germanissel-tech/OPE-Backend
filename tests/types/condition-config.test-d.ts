// Feature 015 (F-039; ADR-026): the facts the configuration parses are exactly the domain's —
// a fact added to the domain without its parser does not compile, and a stranger in the list
// neither. Verified with `npm run typecheck` (not executed).
import type { ConfiguredFact } from "../../src/application/configuration/index.js";
import type { FactCondition } from "../../src/domain/barrier/index.js";

type DomainFact = FactCondition["fact"];

/** No fact of the domain is missing from the configuration's list. */
export const missingIsNever: [Exclude<DomainFact, ConfiguredFact>] extends [never] ? true : false = true;

/** No fact of the configuration is unknown to the domain. */
export const strangerIsNever: [Exclude<ConfiguredFact, DomainFact>] extends [never] ? true : false = true;

// @ts-expect-error a name outside the domain's vocabulary is not a configured fact.
export const stranger: ConfiguredFact = "socialProof";
