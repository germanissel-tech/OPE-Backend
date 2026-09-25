// The concepts OPE has curated prose for (feature 027): replica of
// contracts/components/schemas/AttributeValue.yaml (the source); a test verifies they match.
//
// **OPE's vocabulary, not the merchant's.** `CatalogProduct.attributes` is free text the platform
// exposes without normalisation, so a value of the merchant is never shown: it corresponds to one of
// these, or the product says nothing about it. A value nobody wrote a sentence for does not exist
// for the message, and adding one is a product decision —someone writes its prose— never
// configuration.
export const ATTRIBUTE_VALUES = ["combed-cotton", "jersey", "linen", "denim", "leather"] as const;
export type AttributeValue = (typeof ATTRIBUTE_VALUES)[number];
