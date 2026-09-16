// ope-request-example / ope-success-response-example (FR-014): todo media type de request body y
// de respuesta 2xx lleva al menos un ejemplo (example, examples, o en el schema).
"use strict";

const hasExamples = (obj) =>
  Boolean(obj) &&
  (obj.example !== undefined ||
    (obj.examples && typeof obj.examples === "object" && Object.keys(obj.examples).length > 0));

module.exports = (mediaType, _opts, context) => {
  if (!mediaType || typeof mediaType !== "object") return [];
  if (hasExamples(mediaType) || hasExamples(mediaType.schema)) return [];
  return [{ message: "Falta ejemplo: agregá `example` o `examples` a este media type.", path: context.path }];
};
