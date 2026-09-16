// ope-request-example / ope-success-response-example (FR-014): todo media type de request body y
// de respuesta 2xx lleva al menos un ejemplo (example, examples, o en el schema).
"use strict";
const { get, isObject } = require("./_walk.js");

/** @import { SpectralFunction } from "./_walk.js" */

/** @param {unknown} obj */
const hasExamples = (obj) => {
  if (!isObject(obj)) return false;
  const examples = obj["examples"];
  return obj["example"] !== undefined || (isObject(examples) && Object.keys(examples).length > 0);
};

/** @type {SpectralFunction} */
const hasExample = (mediaType, _opts, context) => {
  if (!isObject(mediaType)) return [];
  if (hasExamples(mediaType) || hasExamples(get(mediaType, "schema"))) return [];
  return [{ message: "Falta ejemplo: agregá `example` o `examples` a este media type.", path: context.path }];
};

module.exports = hasExample;
