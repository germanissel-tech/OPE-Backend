// How what an authority answered becomes what the decision records, and nothing else. Four pure
// translations, lifted out of the orchestrator because they are a different job: the orchestrator
// owns **the order the five authorities are consulted in** (constitution I), and giving a shape to
// what each one said is not part of that order — it is the same translation whatever the order is.
//
// The seam is visible in what these functions do not touch: no port, no dependency, no instant. They
// take a value and return a value, which is why they were already module-level functions rather than
// methods, and moving them changes nothing but where the line between the two jobs is drawn.
import type { ProductFacts } from "../../../domain/barrier/index.js";
import type { CommercialVerdict, Trigger } from "../../../domain/commercial/index.js";
import type { TruthSummary } from "../../../domain/decision/index.js";
import type { DecisionSelection, EvidenceRecord } from "../../../domain/ledger/index.js";
import type { GateEvidence, Judged } from "../../../domain/selection/index.js";
import type { Barrier } from "../../../domain/shared-kernel/index.js";
import type { ProductTruth } from "../../catalog/index.js";
import type { DecisionOutcomeInput } from "../../ledger/index.js";

/** The product truth of the focus as the authorities need it: facts for the rules, a summary for the barrier verdict, evidence for the gate, a record for the ledger. */
export interface Evidence {
  product: ProductFacts;
  truth: TruthSummary;
  gate: GateEvidence;
  record: EvidenceRecord;
}

/** What put the barrier on the table: the rules, the abandonment fallback, or nothing. */
export function triggerOf(inferred: Barrier | undefined, selected: Barrier | undefined): Trigger {
  if (inferred !== undefined) return "rules";
  return selected === undefined ? "none" : "abandonment";
}

/** The barrier of the chosen candidate is the reason of an INTERVENE (contract: Decision.reason). */
export function outcomeOf(verdict: CommercialVerdict): DecisionOutcomeInput {
  return verdict.kind === "no-op"
    ? { kind: "no-op", reason: verdict.reason }
    : { kind: "intervene", reason: verdict.barrier, intervention: verdict.intervention };
}

export function selectionOf(
  judged: readonly Judged[],
  verdict: CommercialVerdict,
  version: string,
): DecisionSelection {
  const candidates = judged.map(({ candidate, verdict: gate }) => ({
    candidateId: candidate.candidateId,
    step: candidate.step,
    verdict: gate.acceptable ? ("acceptable" as const) : ("unacceptable" as const),
    ...(gate.acceptable ? {} : { reason: gate.reason }),
  }));
  if (verdict.kind === "intervene") {
    return {
      candidates,
      chosen: verdict.candidateId,
      commercialVerdict: { blocked: false },
      commercialPolicyVersion: version,
    };
  }
  const chosen = verdict.blocked?.candidateId ?? verdict.chosen;
  const blocked = verdict.blocked;
  const commercialVerdict = blocked ? { blocked: true, reason: blocked.reason } : { blocked: false };
  return {
    candidates,
    ...(chosen === undefined ? {} : { chosen }),
    commercialVerdict,
    commercialPolicyVersion: version,
  };
}

export function evidenceOf(found: ProductTruth): Evidence {
  if (found.kind === "unknown") {
    const attributes = new Map<string, string>();
    return {
      product: { attributes },
      truth: { kind: found.reason },
      // Stryker disable next-line BooleanLiteral: the decision policy refuses an unknown truth before the gate sees it
      gate: { attributes, stockAndPriceFresh: false },
      record: { truth: found.reason },
    };
  }
  const attributes = new Map(found.product.attributes.map((a) => [a.key, a.value]));
  const stockAndPrice = found.stockAndPrice;
  const stockAndPriceFresh = stockAndPrice === "fresh";
  if (found.kind === "known-product") {
    return {
      product: { attributes },
      truth: { kind: found.kind, stockAndPrice },
      gate: { attributes, stockAndPriceFresh },
      record: { truth: found.kind, stockAndPrice },
    };
  }
  const available = found.variant.available;
  return {
    product: { attributes, available },
    truth: { kind: found.kind, stockAndPrice, available },
    gate: { attributes, stockAndPriceFresh, available },
    record: { truth: found.kind, stockAndPrice, available },
  };
}
