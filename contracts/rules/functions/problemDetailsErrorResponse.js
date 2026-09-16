// ope-error-response-problem-details (FR-018): toda respuesta 4xx/5xx es application/problem+json
// con el esquema ProblemDetails. Corre sobre el documento resuelto, así también cubre las
// respuestas definidas en components/responses/*.yaml; el esquema se reconoce por su firma
// (las propiedades obligatorias de RFC 9457 que declara contracts/components/schemas/ProblemDetails.yaml).
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
      message: `Las respuestas 4xx/5xx deben ser application/problem+json con el esquema ProblemDetails (RFC 9457): ${detail}`,
      path: context.path,
    },
  ];
  const content = response["content"];
  if (!isObject(content)) return fail("falta `content`.");
  const keys = Object.keys(content);
  if (keys.length !== 1 || keys[0] !== "application/problem+json") {
    return fail(
      `declara ${keys.join(", ") || "ningún media type"}; tiene que ser exactamente application/problem+json.`,
    );
  }
  const media = content["application/problem+json"];
  if (!looksLikeProblemDetails(get(media, "schema"))) {
    return fail("el schema debe ser $ref a components/schemas/ProblemDetails.yaml.");
  }
  return [];
};

module.exports = problemDetailsErrorResponse;
