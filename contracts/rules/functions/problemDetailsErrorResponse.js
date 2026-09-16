// ope-error-response-problem-details (FR-018): toda respuesta 4xx/5xx es application/problem+json
// con el esquema ProblemDetails. Corre sobre el documento resuelto, así también cubre las
// respuestas definidas en components/responses/*.yaml; el esquema se reconoce por su firma
// (las propiedades obligatorias de RFC 9457 que declara contracts/components/schemas/ProblemDetails.yaml).
"use strict";

const PROBLEM_SIGNATURE = ["type", "title", "status"];

function looksLikeProblemDetails(schema) {
  if (!schema || typeof schema !== "object" || !schema.properties) return false;
  const required = Array.isArray(schema.required) ? schema.required : [];
  return PROBLEM_SIGNATURE.every((p) => p in schema.properties && required.includes(p));
}

module.exports = (response, _opts, context) => {
  if (!response || typeof response !== "object") return [];
  const fail = (detail) => [
    {
      message: `Las respuestas 4xx/5xx deben ser application/problem+json con el esquema ProblemDetails (RFC 9457): ${detail}`,
      path: context.path,
    },
  ];
  const content = response.content;
  if (!content || typeof content !== "object") return fail("falta `content`.");
  const keys = Object.keys(content);
  if (keys.length !== 1 || keys[0] !== "application/problem+json") {
    return fail(`declara ${keys.join(", ") || "ningún media type"}; tiene que ser exactamente application/problem+json.`);
  }
  const media = content["application/problem+json"];
  if (!media || !looksLikeProblemDetails(media.schema)) {
    return fail("el schema debe ser $ref a components/schemas/ProblemDetails.yaml.");
  }
  return [];
};
