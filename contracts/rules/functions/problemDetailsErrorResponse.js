// ope-error-response-problem-details (FR-018): every 4xx/5xx response is application/problem+json
// with the ProblemDetails schema. Runs on the resolved document, so it also covers the
// responses defined in components/responses/*.yaml; the schema is recognised by its signature
// (the required RFC 9457 properties that contracts/components/schemas/ProblemDetails.yaml declares).
"use strict";
const { get, isObject } = require("./_walk.js");

/** @import { SpectralFunction, SpectralResult } from "./_walk.js" */

const PROBLEM_SIGNATURE = ["type", "title", "status"];

/** @param {unknown} schema */
function looksLikeProblemDetails(schema) {
  const properties = get(schema, "properties");
  if (!isObject(properties)) return false;
  const required = get(schema, "required");
  const requiredList = Array.isArray(required) ? required : [];
  return PROBLEM_SIGNATURE.every((p) => p in properties && requiredList.includes(p));
}

/** @type {SpectralFunction} */
const problemDetailsErrorResponse = (response, _opts, context) => {
  if (!isObject(response)) return [];
  /** @param {string} detail @returns {SpectralResult[]} */
  const fail = (detail) => [
    {
      message: `4xx/5xx responses must be application/problem+json with the ProblemDetails schema (RFC 9457): ${detail}`,
      path: context.path,
    },
  ];
  const content = response["content"];
  if (!isObject(content)) return fail("`content` is missing.");
  const keys = Object.keys(content);
  if (keys.length !== 1 || keys[0] !== "application/problem+json") {
    return fail(
      `declares ${keys.join(", ") || "no media type"}; it has to be exactly application/problem+json.`,
    );
  }
  const media = content["application/problem+json"];
  if (!looksLikeProblemDetails(get(media, "schema"))) {
    return fail("the schema must be a $ref to components/schemas/ProblemDetails.yaml.");
  }
  return [];
};

module.exports = problemDetailsErrorResponse;
