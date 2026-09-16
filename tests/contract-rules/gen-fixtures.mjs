// Genera los fixtures de tests/contract-rules/fixtures/: un contrato mínimo por regla, que
// viola sólo la regla que lleva en el nombre. No editar los fixtures a mano:
//   node tests/contract-rules/gen-fixtures.mjs
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

// Los fixtures se construyen mutando objetos JSON libres; el tipo es deliberadamente laxo
// (cualquier objeto con claves string) porque cada mutador rompe una parte distinta del contrato.
/** @typedef {Record<string, any>} Doc */
/** @typedef {(d: Doc) => Doc} Mutator */
mkdirSync(out, { recursive: true });

const problemSchema = () => ({
  type: "object",
  description: "Problem Details (RFC 9457).",
  additionalProperties: false,
  required: ["type", "title", "status"],
  properties: {
    type: { type: "string", description: "Tipo de problema." },
    title: { type: "string", description: "Título." },
    status: { type: "integer", description: "Código HTTP." },
  },
});
/**
 * @param {string} description
 * @param {number} status
 * @param {string} slug
 * @returns {Doc}
 */
const problemResponse = (description, status, slug) => ({
  description,
  content: {
    "application/problem+json": {
      schema: { $ref: "#/components/schemas/ProblemDetails" },
      example: { type: `urn:ope:problem:${slug}`, title: "t", status },
    },
  },
});

/** @returns {Doc} */
const base = () => ({
  openapi: "3.1.0",
  info: {
    title: "Fixture",
    version: "1.0.0",
    description: "Contrato mínimo de prueba.",
    contact: { name: "OPE" },
  },
  servers: [{ url: "/" }],
  tags: [{ name: "system", description: "Sistema." }],
  paths: {
    "/v1/health": {
      get: {
        operationId: "getHealth",
        tags: ["system"],
        summary: "Salud del fixture",
        description: "Devuelve el estado.",
        security: [],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Health" },
                example: { status: "ok" },
              },
            },
          },
          500: { $ref: "#/components/responses/InternalServerError" },
        },
      },
    },
  },
  components: {
    schemas: {
      Health: {
        type: "object",
        description: "Estado.",
        additionalProperties: false,
        required: ["status"],
        properties: { status: { type: "string", description: "Salud." } },
      },
      ProblemDetails: problemSchema(),
    },
    responses: {
      InternalServerError: problemResponse("Error interno.", 500, "internal-error"),
    },
  },
});

/** Agrega POST /v1/things con request body válido (schema por $ref, como exige rule/media-type-schema-ref). */
/** @param {Doc} doc */
const withThings = (doc) => {
  doc.components.schemas.ThingCreate = {
    type: "object",
    description: "Cosa a crear.",
    additionalProperties: false,
    required: ["kind"],
    properties: {
      kind: { type: "string", description: "Clase de cosa.", enum: ["a", "b"] },
      meta: {
        type: "object",
        description: "Metadatos.",
        additionalProperties: false,
        properties: { note: { type: "string", description: "Nota." } },
      },
    },
  };
  doc.paths["/v1/things"] = {
    post: {
      operationId: "createThing",
      tags: ["system"],
      summary: "Crea una cosa",
      description: "Crea una cosa.",
      security: [],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ThingCreate" },
            example: { kind: "a", meta: { note: "n" } },
          },
        },
      },
      responses: {
        201: {
          description: "Creada.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Health" },
              example: { status: "ok" },
            },
          },
        },
        400: { $ref: "#/components/responses/BadRequest" },
        422: { $ref: "#/components/responses/ThingUnprocessable" },
        500: { $ref: "#/components/responses/InternalServerError" },
      },
    },
  };
  doc.components.responses.BadRequest = problemResponse("Request inválido.", 400, "validation-failed");
  // El 422 nombra la invariante propia (validation-failed) que ThingCreate declara.
  doc.components.responses.ThingUnprocessable = problemResponse("No procesable.", 422, "validation-failed");
  doc.components.schemas.ThingCreate["x-invariants"] = [
    { type: "validation-failed", status: 400, rule: "kind in [a, b]", description: "Clase válida." },
  ];
  return doc;
};

/** Agrega un securityScheme y vuelve autenticada la operación dada. */
/**
 * @param {Doc} doc
 * @param {Doc} op
 * @param {string[] | null} [capabilities] null: autenticada sin capacidad declarada
 */
const withAuth = (doc, op, capabilities = ["things:write"]) => {
  doc.components.securitySchemes = {
    ingestKey: { type: "apiKey", in: "header", name: "X-Api-Key", description: "Clave de ingesta." },
  };
  op.security = [{ ingestKey: [] }];
  if (capabilities) op["x-required-capabilities"] = capabilities;
  op.responses["401"] = { $ref: "#/components/responses/Unauthorized" };
  doc.components.responses.Unauthorized = problemResponse("Sin credencial.", 401, "unauthorized");
  return doc;
};

/** @param {Doc} doc @returns {Doc} */
const health = (doc) => doc.paths["/v1/health"].get;
/** @param {Doc} doc @returns {Doc} */
const things = (doc) => doc.paths["/v1/things"].post;
/** @param {Doc} doc @returns {Doc} */
const bodySchema = (doc) => doc.components.schemas.ThingCreate;

/** @type {Record<string, Mutator>} */
const fixtures = {
  // Válidos
  "valid.yaml": (d) => withThings(d),
  "merchant-id-in-response.yaml": (d) => {
    d.components.schemas.Health.properties.merchantId = {
      type: "string",
      description: "Merchant que respondió.",
    };
    return d;
  },
  "valid-invariants.yaml": (d) => {
    health(d)["x-invariants"] = [
      { type: "not-found", status: 404, rule: "el servicio existe", description: "Siempre existe." },
    ];
    health(d).responses["404"] = { $ref: "#/components/responses/NotFound" };
    d.components.responses.NotFound = problemResponse("No encontrado.", 404, "not-found");
    return d;
  },
  "valid-capabilities.yaml": (d) => withAuth(withThings(d), things(d)),
  // FR-012
  "operation-operationId.yaml": (d) => {
    delete health(d).operationId;
    return d;
  },
  "operation-operationId-unique.yaml": (d) => {
    withThings(d);
    things(d).operationId = "getHealth";
    return d;
  },
  "ope-operation-id-camel-case.yaml": (d) => {
    health(d).operationId = "get_health";
    return d;
  },
  "ope-operation-summary.yaml": (d) => {
    delete health(d).summary;
    return d;
  },
  "operation-description.yaml": (d) => {
    delete health(d).description;
    return d;
  },
  "operation-tags.yaml": (d) => {
    delete health(d).tags;
    return d;
  },
  // FR-004
  "ope-operation-single-tag.yaml": (d) => {
    health(d).tags = ["system", "admin"];
    d.tags.push({ name: "admin", description: "Admin." });
    return d;
  },
  "ope-tags-closed-catalog.yaml": (d) => {
    health(d).tags = ["misc"];
    d.tags = [{ name: "misc", description: "Fuera de catálogo." }];
    return d;
  },
  // FR-013
  "ope-property-description.yaml": (d) => {
    delete d.components.schemas.Health.properties.status.description;
    return d;
  },
  // FR-014
  "ope-request-example.yaml": (d) => {
    withThings(d);
    delete things(d).requestBody.content["application/json"].example;
    return d;
  },
  "ope-success-response-example.yaml": (d) => {
    delete health(d).responses["200"].content["application/json"].example;
    return d;
  },
  // FR-015 (objeto anidado abierto)
  "ope-request-closed-schema.yaml": (d) => {
    withThings(d);
    delete bodySchema(d).properties.meta.additionalProperties;
    return d;
  },
  // FR-015 (una unión envuelta en `type: object` no se cierra ahí, pero sus ramas sí: una rama
  // abierta sigue fallando).
  "ope-request-closed-schema.union.yaml": (d) => {
    withThings(d);
    bodySchema(d).properties.meta = {
      type: "object",
      description: "Metadatos por variante.",
      oneOf: [
        {
          type: "object",
          description: "Variante abierta (viola).",
          properties: { note: { type: "string", description: "Nota." } },
        },
      ],
    };
    return d;
  },
  "valid-union.yaml": (d) => {
    withThings(d);
    bodySchema(d).properties.meta = {
      type: "object",
      description: "Metadatos por variante.",
      oneOf: [
        {
          type: "object",
          description: "Variante cerrada.",
          additionalProperties: false,
          properties: { note: { type: "string", description: "Nota." } },
        },
      ],
    };
    return d;
  },
  // FR-016
  "ope-no-pii.yaml": (d) => {
    d.components.schemas.Health.properties.Email = { type: "string", description: "Correo." };
    return d;
  },
  "ope-no-pii.parameter.yaml": (d) => {
    health(d).parameters = [
      { name: "phone", in: "query", description: "Teléfono.", schema: { type: "string" } },
    ];
    return d;
  },
  // FR-017
  "ope-no-merchant-id-in-request.path.yaml": (d) => {
    const op = health(d);
    op.parameters = [
      {
        name: "merchantId",
        in: "path",
        required: true,
        description: "Merchant.",
        schema: { type: "string" },
      },
    ];
    d.paths["/v1/merchants/{merchantId}/health"] = { get: op };
    delete d.paths["/v1/health"];
    return d;
  },
  "ope-no-merchant-id-in-request.query.yaml": (d) => {
    health(d).parameters = [
      { name: "merchant_id", in: "query", description: "Merchant.", schema: { type: "string" } },
    ];
    return d;
  },
  "ope-no-merchant-id-in-request.header.yaml": (d) => {
    health(d).parameters = [
      { name: "X-Merchant-Id", in: "header", description: "Merchant.", schema: { type: "string" } },
    ];
    return d;
  },
  "ope-no-merchant-id-in-request.cookie.yaml": (d) => {
    health(d).parameters = [
      { name: "MerchantId", in: "cookie", description: "Merchant.", schema: { type: "string" } },
    ];
    return d;
  },
  "ope-no-merchant-id-in-request.body.yaml": (d) => {
    withThings(d);
    bodySchema(d).properties.meta.properties.merchantId = { type: "string", description: "Merchant." };
    return d;
  },
  // FR-018
  "ope-error-response-problem-details.yaml": (d) => {
    health(d).responses["404"] = {
      description: "No encontrado.",
      content: {
        "application/json": { schema: { $ref: "#/components/schemas/Health" }, example: { status: "ok" } },
      },
    };
    return d;
  },
  "ope-error-response-problem-details.component.yaml": (d) => {
    delete d.components.schemas.ProblemDetails;
    d.components.responses.InternalServerError = {
      description: "Error.",
      content: {
        "application/json": { schema: { $ref: "#/components/schemas/Health" }, example: { status: "ok" } },
      },
    };
    return d;
  },
  // FR-019
  "ope-required-error-responses.500.yaml": (d) => {
    delete health(d).responses["500"];
    delete d.components.responses.InternalServerError;
    delete d.components.schemas.ProblemDetails;
    return d;
  },
  "ope-required-error-responses.401.yaml": (d) => {
    withAuth(d, health(d));
    delete health(d).responses["401"];
    delete d.components.responses.Unauthorized;
    return d;
  },
  "ope-required-error-responses.400-422.yaml": (d) => {
    withThings(d);
    delete things(d).responses["400"];
    delete things(d).responses["422"];
    delete d.components.responses.BadRequest;
    delete d.components.responses.ThingUnprocessable;
    return d;
  },
  // FR-003
  "ope-path-version-prefix.yaml": (d) => {
    d.info.version = "2.0.0";
    return d;
  },

  // ---- Feature 002 ----
  // ope-invariants (FR-002)
  "ope-invariants.missing-field.yaml": (d) => {
    health(d)["x-invariants"] = [{ type: "not-found", status: 404, description: "Sin rule." }];
    return d;
  },
  "ope-invariants.unknown-type.yaml": (d) => {
    health(d)["x-invariants"] = [{ type: "no-existe", status: 422, rule: "x", description: "y" }];
    return d;
  },
  "ope-invariants.status-mismatch.yaml": (d) => {
    health(d)["x-invariants"] = [{ type: "not-found", status: 422, rule: "x", description: "y" }];
    return d;
  },
  "ope-invariants.generic.yaml": (d) => {
    health(d)["x-invariants"] = [{ type: "unprocessable", status: 422, rule: "x", description: "y" }];
    return d;
  },
  // ope-no-generic-422 (FR-004)
  "ope-no-generic-422.generic-example.yaml": (d) => {
    withThings(d);
    d.components.responses.ThingUnprocessable = problemResponse("No procesable.", 422, "unprocessable");
    return d;
  },
  "ope-no-generic-422.undeclared.yaml": (d) => {
    withThings(d);
    d.components.responses.ThingUnprocessable = problemResponse("No procesable.", 422, "not-found");
    return d;
  },
  // ope-required-capabilities (FR-031)
  "ope-required-capabilities.missing.yaml": (d) => withAuth(withThings(d), things(d), null),
  "ope-required-capabilities.empty.yaml": (d) => withAuth(withThings(d), things(d), []),
  "ope-required-capabilities.bad-format.yaml": (d) => withAuth(withThings(d), things(d), ["Events Write"]),
  "ope-required-capabilities.public.yaml": (d) => {
    health(d)["x-required-capabilities"] = ["system:read"];
    return d;
  },
  "ope-required-capabilities.inherited.yaml": (d) => {
    withAuth(withThings(d), things(d), null);
    d.security = things(d).security;
    delete things(d).security;
    return d;
  },
};

for (const stale of readdirSync(out)) {
  if (stale.endsWith(".yaml") && !(stale in fixtures)) unlinkSync(path.join(out, stale));
}
for (const [file, mutate] of Object.entries(fixtures)) {
  const doc = mutate(base());
  const header = `# Fixture de tests/contract-rules: ${file.replace(/\.yaml$/, "")}. Generado por gen-fixtures.mjs a partir de un contrato mínimo válido; viola sólo la regla que lleva en el nombre.\n`;
  writeFileSync(path.join(out, file), header + stringify(doc, { lineWidth: 0 }), "utf8");
}
console.log(`${Object.keys(fixtures).length} fixtures en ${out}`);
