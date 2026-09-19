// The quality gate (01-arquitectura-mvp.md §4.4; constitution II; ADR-027): a pure judge of
// candidates. Each claim of a candidate needs evidence of its class and, where the merchant
// must have declared it, the merchant's word; the first claim without support rejects the
// candidate entire — UNACCEPTABLE is a kind of failure, not a low score. The gate knows no
// ceiling, margin or policy: nothing in configuration relaxes it.
import { ATTRIBUTE_CLAIM_PREFIX, type Candidate, type Claim } from "./candidate.js";
import type { MerchantProfile } from "./profile.js";

/** What the product truth says, flattened for the claims (the catalog module answers it). */
export interface GateEvidence {
  attributes: ReadonlyMap<string, string>;
  stockAndPriceFresh: boolean;
  /** Absent when no variant is in focus (the size recommendation needs one). */
  available?: boolean;
}

export type GateRejection =
  | "no-returns-policy"
  | "no-fit-data"
  | "stale-price"
  | "variant-unavailable"
  | "attribute-unknown"
  | "attribute-not-authorized";

export type GateVerdict = { acceptable: true } | { acceptable: false; reason: GateRejection };

export interface Judged {
  candidate: Candidate;
  verdict: GateVerdict;
}

const ACCEPTABLE: GateVerdict = { acceptable: true };

export class QualityGate {
  readonly #profile: MerchantProfile;

  private constructor(profile: MerchantProfile) {
    this.#profile = profile;
  }

  /** The gate of a merchant: what it declared is the only word the gate takes. */
  static of(profile: MerchantProfile): QualityGate {
    return new QualityGate(profile);
  }

  /** The verdict on one candidate: the first claim without support, in declaration order, rejects it. */
  judge(candidate: Candidate, evidence: GateEvidence): GateVerdict {
    for (const claim of candidate.claims) {
      const reason = this.#unsupported(claim, evidence);
      if (reason !== undefined) return { acceptable: false, reason };
    }
    return ACCEPTABLE;
  }

  /** Every candidate judged, in the order given (the ladder). */
  judgeAll(candidates: readonly Candidate[], evidence: GateEvidence): readonly Judged[] {
    return candidates.map((candidate) => ({ candidate, verdict: this.judge(candidate, evidence) }));
  }

  #unsupported(claim: Claim, evidence: GateEvidence): GateRejection | undefined {
    switch (claim) {
      case "returns-policy":
        return this.#profile.returnsPolicy ? undefined : "no-returns-policy";
      case "fit-data":
        return this.#profile.fitData ? undefined : "no-fit-data";
      case "current-price":
        return evidence.stockAndPriceFresh ? undefined : "stale-price";
      case "availability":
        return evidence.available === true ? undefined : "variant-unavailable";
      case "incentive":
        // Whether an incentive may be granted is the commercial policy's, not the gate's.
        return undefined;
      default:
        return this.#attribute(claim.slice(ATTRIBUTE_CLAIM_PREFIX.length), evidence);
    }
  }

  #attribute(key: string, evidence: GateEvidence): GateRejection | undefined {
    if (!evidence.attributes.has(key)) return "attribute-unknown";
    return this.#profile.authorizedAttributes.includes(key) ? undefined : "attribute-not-authorized";
  }
}
