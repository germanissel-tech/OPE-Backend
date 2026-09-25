// The attribute keys of the catalogue OPE can speak about (feature 027). They live in the kernel
// because two modules that cannot depend on each other share them: `selection` declares the claim
// that names one, and `messages` resolves the text for its value. Not published by the contract —
// what a merchant declares is which keys it authorises (`EvidenceProfile.authorizedAttributes`),
// not which ones OPE knows.
//
// A key here is a promise that OPE has prose for at least some of its values. Adding one is a
// product decision, never configuration.
// A union of literals and not a list, while there is one key: a list nobody iterates is a constant
// with extra steps. It becomes `["material", …] as const` the day a second key arrives, and the
// compiler will ask for the rest.
export type AttributeKey = "material";

/** What a garment is made of: the first attribute OPE writes about. */
export const MATERIAL: AttributeKey = "material";
