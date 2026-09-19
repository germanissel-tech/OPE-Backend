// What a merchant declares it can sustain (03-alcance-mvp.md §4.5; ADR-027): a returns policy
// to cite, fit data to recommend a size, product attributes the messages may name. Nothing
// declared means nothing may be claimed (fail-closed, constitution II).

export interface MerchantProfile {
  returnsPolicy: boolean;
  fitData: boolean;
  authorizedAttributes: readonly string[];
}

/** The profile of a merchant that declared nothing: no claim with evidence of its class passes. */
export const EMPTY_PROFILE: MerchantProfile = {
  returnsPolicy: false,
  fitData: false,
  authorizedAttributes: [],
};
