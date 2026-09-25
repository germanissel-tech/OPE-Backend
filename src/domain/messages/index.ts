// Public API of the messages module (domain): the curated texts OPE shows and what identifies
// them. The corpus is an asset of the release, written and reviewed by a person before it is
// served (constitution VIII). The error classes stay inside: the union is the public shape.
export { ATTRIBUTE_VALUES } from "./attribute-values.js";
export type { AttributeValue } from "./attribute-values.js";
export { AttributeLabels } from "./attribute-labels.js";
export type { AttributeLabelRecord, AttributeLabelsError } from "./attribute-labels.js";
export { CuratedText } from "./curated-text.js";
export type { MessageError } from "./errors.js";
export { messageVersion } from "./ids.js";
export type { MessageVersion } from "./ids.js";
