// The commercial policy a merchant gets when it declares none (ADR-027): the values proposed to
// the stakeholder in feature 012 — a ceiling of 10 % with steps of 5 and 10 (as rates), no margin (so no
// incentive goes out until the merchant configures one, 01 §4.7), the incentive directly on
// the price barrier, a high return risk when the visitor doubted the size and read the
// policies, high intent from the checkout, the returns reassurance on a cart abandonment
// without a signal, one intervention per session, no cooldown and three per visitor and day.
// Built by the factory at load time: an invalid default is a programming error.
import { CommercialPolicy } from "./commercial-policy.js";

export const DEFAULT_COMMERCIAL_POLICY_VERSION = "commercial-default-1";

const CEILING_SHARE = 0.1;
const FIRST_STEP_SHARE = 0.05;
const LADDER_SHARE = [FIRST_STEP_SHARE, CEILING_SHARE];
const SIZE_DOUBT_INTERACTIONS = 2;
const PER_VISITOR_PER_DAY = 3;

function build(): CommercialPolicy {
  const policy = CommercialPolicy.of({
    version: DEFAULT_COMMERCIAL_POLICY_VERSION,
    maxIncentiveShare: CEILING_SHARE,
    incentiveLadderShare: LADDER_SHARE,
    directIncentiveOnPrice: true,
    returnRisk: {
      all: [
        { fact: "eventCount", type: "size_selector_interacted", min: SIZE_DOUBT_INTERACTIONS },
        { fact: "dwellSeconds", block: "policies" },
      ],
    },
    highIntent: "from-checkout",
    abandonment: "reassure-returns",
    interventionsPerSession: 1,
    cooldownSeconds: 0,
    interventionsPerVisitorPerDay: PER_VISITOR_PER_DAY,
  });
  if (!policy.ok) throw new Error(`The default commercial policy is invalid: ${policy.error.message}`);
  return policy.value;
}

export const DEFAULT_COMMERCIAL_POLICY: CommercialPolicy = build();
