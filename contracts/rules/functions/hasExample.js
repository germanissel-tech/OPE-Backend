// ope-request-example / ope-success-response-example (FR-014): every media type of a request body
// and of a 2xx response carries at least one example (example, examples, or in the schema).
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
  return [
    { message: "Missing example: add `example` or `examples` to this media type.", path: context.path },
  ];
};

module.exports = hasExample;
