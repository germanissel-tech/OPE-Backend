// Candidate interventions (01-arquitectura-mvp.md §4.4; 03-alcance-mvp.md §4.8; ADR-027): for
// each barrier, the interventions OPE may make, ordered by the incentive ladder — information,
// reassurance, uncertainty, evidence, incentive — each declaring the claims it makes. A closed
// vocabulary of OPE: a merchant declares what evidence it provides, never new candidates
// (those arrive with the message catalogue feature of the map). Until then the candidate id is the
// placeholder message version `msg_<barrier>_<anchor>_<step>_v0`.
import type { Anchor, Barrier } from "../shared-kernel/index.js";

/** The steps of the incentive ladder, from the cheapest in margin to the incentive itself. */
export const STEPS = ["information", "reassurance", "uncertainty", "evidence", "incentive"] as const;
export type Step = (typeof STEPS)[number];

/**
 * The classes of claim a candidate may make, each demanding evidence of its class (03 §4.5),
 * closed by `kind`: the gate switches over it without a default, so a class nobody judges does
 * not compile (015 F-038). A product attribute claim names its key. Numeric scarcity and social
 * proof do not exist: they cannot be claimed.
 */
export type Claim =
  | { kind: "returns-policy" }
  | { kind: "fit-data" }
  | { kind: "current-price" }
  | { kind: "availability" }
  | { kind: "incentive" }
  | { kind: "product-attribute"; key: string };
export type ClaimKind = Claim["kind"];

export interface Candidate {
  candidateId: string;
  barrier: Barrier;
  step: Step;
  anchor: Anchor;
  claims: readonly Claim[];
}

const MESSAGE_PLACEHOLDER_VERSION = "v0";

/** The placeholder id of a candidate until the message catalogue names real versions. */
const candidateId = (barrier: Barrier, anchor: Anchor, step: Step): string =>
  `msg_${barrier}_${anchor}_${step}_${MESSAGE_PLACEHOLDER_VERSION}`;

const candidate = (barrier: Barrier, anchor: Anchor, step: Step, claims: readonly Claim[]): Candidate => ({
  candidateId: candidateId(barrier, anchor, step),
  barrier,
  step,
  anchor,
  claims,
});

/** The candidates of the MVP, per barrier, in ladder order (spec 012, Assumptions). */
export const CANDIDATES: Readonly<Record<Barrier, readonly Candidate[]>> = {
  fit: [
    candidate("fit", "size_selector", "information", []),
    candidate("fit", "policies", "reassurance", [{ kind: "returns-policy" }]),
    candidate("fit", "size_selector", "evidence", [{ kind: "fit-data" }, { kind: "availability" }]),
  ],
  price: [
    candidate("price", "price", "information", []),
    candidate("price", "price", "evidence", [{ kind: "current-price" }]),
    candidate("price", "price", "incentive", [{ kind: "incentive" }]),
  ],
  returns: [
    candidate("returns", "policies", "information", []),
    candidate("returns", "policies", "reassurance", [{ kind: "returns-policy" }]),
  ],
};
