// Generates the fixtures of tests/contract-rules/fixtures/: one minimal contract per rule, which
// violates only the rule in its name. Do not edit the fixtures by hand:
//   node tests/contract-rules/gen-fixtures.mjs
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

// Fixtures are built by mutating free-form JSON objects; the type is deliberately loose
// (any object with string keys) because each mutator breaks a different part of the contract.
/** @typedef {Record<string, any>} Doc */
/** @typedef {(d: Doc) => Doc} Mutator */
mkdirSync(out, { recursive: true });

const problemSchema = () => ({
  type: "object",
  description: "Problem Details (RFC 9457).",
  additionalProperties: false,
  required: ["type", "title", "status"],
  properties: {
    type: { type: "string", description: "Problem type." },
    title: { type: "string", description: "Title." },
    status: { type: "integer", description: "HTTP status." },
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
    description: "Minimal test contract.",
    contact: { name: "OPE" },
  },
  servers: [{ url: "/" }],
  tags: [{ name: "system", description: "Sistema." }],
  paths: {
    "/v1/health": {
      get: {
        operationId: "getHealth",
        tags: ["system"],
        summary: "Fixture health",
        description: "Returns the status.",
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

/** Adds POST /v1/things with a valid request body (schema by $ref, as rule/media-type-schema-ref demands). */
/** @param {Doc} doc */
const withThings = (doc) => {
  doc.components.schemas.ThingCreate = {
    type: "object",
    description: "Cosa a crear.",
    additionalProperties: false,
    required: ["kind"],
    properties: {
      kind: { type: "string", description: "Kind of thing.", enum: ["a", "b"] },
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
      summary: "Creates a thing",
      description: "Creates a thing.",
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
  doc.components.responses.BadRequest = problemResponse("Invalid request.", 400, "validation-failed");
  // The 422 names the invariant of its own (validation-failed) that ThingCreate declares.
  doc.components.responses.ThingUnprocessable = problemResponse("No procesable.", 422, "validation-failed");
  doc.components.schemas.ThingCreate["x-invariants"] = [
    { type: "validation-failed", status: 400, rule: "kind in [a, b]", description: "Valid kind." },
  ];
  return doc;
};

/** Adds a securityScheme and makes the given operation authenticated. */
/**
 * @param {Doc} doc
 * @param {Doc} op
 * @param {string[] | null} [capabilities] null: authenticated without a declared capability
 */
const withAuth = (doc, op, capabilities = ["events:write"]) => {
  doc.components.securitySchemes = {
    ...doc.components.securitySchemes,
    ingestKey: { type: "apiKey", in: "header", name: "X-Api-Key", description: "Ingest key." },
  };
  withTag(doc, op, "ingest");
  op.security = [{ ingestKey: [] }];
  if (capabilities) op["x-required-capabilities"] = capabilities;
  op.responses["401"] = { $ref: "#/components/responses/Unauthorized" };
  doc.components.responses.Unauthorized = problemResponse("No credential.", 401, "unauthorized");
  return doc;
};

/**
 * Gives the operation a tag of the given consumer (the tag fixes the consumer, ADR-020) and declares it.
 * @param {Doc} doc @param {Doc} op @param {string} tag
 */
const withTag = (doc, op, tag) => {
  op.tags = [tag];
  if (!doc.tags.some((/** @type {Doc} */ t) => t.name === tag))
    doc.tags.push({ name: tag, description: `${tag}.` });
  return doc;
};

/** A security scheme of the given consumer, declared in the fixture. */
/** @param {Doc} doc @param {string} name */
const withScheme = (doc, name) => {
  doc.components.securitySchemes = {
    ...doc.components.securitySchemes,
    [name]: { type: "http", scheme: "bearer", description: `${name} token.` },
  };
  return doc;
};

/** Adds the planned notifyOrder of the platform consumer, valid per ADR-020 (x-idempotency + 409). */
/** @param {Doc} doc */
const withNotifyOrder = (doc) => {
  doc.components.schemas.OrderNotification = {
    type: "object",
    description: "Confirmed order.",
    additionalProperties: false,
    required: ["orderId", "amount"],
    properties: {
      orderId: { type: "string", description: "Order identity of the platform." },
      amount: { type: "string", description: "Amount." },
    },
  };
  doc.components.securitySchemes = {
    ...doc.components.securitySchemes,
    platformKey: { type: "apiKey", in: "header", name: "X-OPE-Platform-Key", description: "Platform key." },
  };
  doc.components.responses.BadRequest = problemResponse("Invalid request.", 400, "validation-failed");
  doc.components.responses.Unauthorized = problemResponse("No credential.", 401, "unauthorized");
  doc.components.responses.Conflict = problemResponse("Conflict.", 409, "idempotency-conflict");
  doc.components.responses.OrderUnprocessable = problemResponse("Unprocessable.", 422, "validation-failed");
  doc.components.schemas.OrderNotification["x-invariants"] = [
    {
      type: "validation-failed",
      status: 400,
      rule: "amount is a decimal string",
      description: "Valid amount.",
    },
  ];
  const ok = {
    description: "Recorded.",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/Health" }, example: { status: "ok" } },
    },
  };
  doc.paths["/v1/orders"] = {
    post: {
      operationId: "notifyOrder",
      tags: ["outcomes"],
      summary: "Notifies an order",
      description: "Notifies a confirmed order.",
      security: [{ platformKey: [] }],
      "x-required-capabilities": ["orders:write"],
      "x-idempotency": { key: "orderId", first: "201", repeat: "200" },
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/OrderNotification" },
            example: { orderId: "o-1", amount: "10.00" },
          },
        },
      },
      responses: {
        201: ok,
        200: ok,
        400: { $ref: "#/components/responses/BadRequest" },
        401: { $ref: "#/components/responses/Unauthorized" },
        409: { $ref: "#/components/responses/Conflict" },
        422: { $ref: "#/components/responses/OrderUnprocessable" },
        500: { $ref: "#/components/responses/InternalServerError" },
      },
    },
  };
  doc.tags.push({ name: "outcomes", description: "outcomes." });
  return doc;
};
/** @param {Doc} doc @returns {Doc} */
const orders = (doc) => doc.paths["/v1/orders"].post;

/** Adds the planned listDecisions (collection) and getDecision (single) of the portal consumer. */
/** @param {Doc} doc */
const withPortal = (doc) => {
  withScheme(doc, "portalSession");
  doc.components.schemas.DecisionPage = {
    type: "object",
    description: "Page of decisions.",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: { type: "array", description: "Decisions.", items: { $ref: "#/components/schemas/Health" } },
      nextCursor: { type: "string", description: "Next page." },
    },
  };
  doc.components.parameters = {
    cursor: { name: "cursor", in: "query", description: "Cursor.", schema: { type: "string" } },
    limit: {
      name: "limit",
      in: "query",
      description: "Limit.",
      schema: { type: "integer", minimum: 1, maximum: 100 },
    },
    from: {
      name: "from",
      in: "query",
      description: "From.",
      schema: { type: "string", format: "date-time" },
    },
    to: { name: "to", in: "query", description: "To.", schema: { type: "string", format: "date-time" } },
  };
  doc.components.responses.Unauthorized = problemResponse("No credential.", 401, "unauthorized");
  const page = {
    description: "Page.",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/DecisionPage" }, example: { items: [] } },
    },
  };
  doc.paths["/v1/portal/decisions"] = {
    get: {
      operationId: "listDecisions",
      tags: ["portal"],
      summary: "Lists decisions",
      description: "Lists the decisions of the merchant.",
      security: [{ portalSession: [] }],
      "x-required-capabilities": ["ledger:read"],
      "x-collection": true,
      parameters: [
        { $ref: "#/components/parameters/cursor" },
        { $ref: "#/components/parameters/limit" },
        { $ref: "#/components/parameters/from" },
        { $ref: "#/components/parameters/to" },
      ],
      responses: {
        200: page,
        401: { $ref: "#/components/responses/Unauthorized" },
        500: { $ref: "#/components/responses/InternalServerError" },
      },
    },
  };
  doc.paths["/v1/portal/decisions/{decisionId}"] = {
    get: {
      operationId: "getDecision",
      tags: ["portal"],
      summary: "Reads a decision",
      description: "Reads one decision.",
      security: [{ portalSession: [] }],
      "x-required-capabilities": ["ledger:read"],
      parameters: [
        {
          name: "decisionId",
          in: "path",
          required: true,
          description: "Decision.",
          schema: { type: "string" },
        },
      ],
      responses: {
        200: {
          description: "Decision.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Health" },
              example: { status: "ok" },
            },
          },
        },
        401: { $ref: "#/components/responses/Unauthorized" },
        500: { $ref: "#/components/responses/InternalServerError" },
      },
    },
  };
  doc.tags.push({ name: "portal", description: "portal." });
  return doc;
};
/** @param {Doc} doc @returns {Doc} */
const decisions = (doc) => doc.paths["/v1/portal/decisions"].get;

/** @param {Doc} doc @returns {Doc} */
const health = (doc) => doc.paths["/v1/health"].get;
/** @param {Doc} doc @returns {Doc} */
const things = (doc) => doc.paths["/v1/things"].post;
/** @param {Doc} doc @returns {Doc} */
const bodySchema = (doc) => doc.components.schemas.ThingCreate;

/** @type {Record<string, Mutator>} */
const fixtures = {
  // Valid ones
  "valid.yaml": (d) => withThings(d),
  "merchant-id-in-response.yaml": (d) => {
    d.components.schemas.Health.properties.merchantId = {
      type: "string",
      description: "Merchant that responded.",
    };
    return d;
  },
  "valid-invariants.yaml": (d) => {
    health(d)["x-invariants"] = [
      { type: "not-found", status: 404, rule: "the service exists", description: "It always exists." },
    ];
    health(d).responses["404"] = { $ref: "#/components/responses/NotFound" };
    d.components.responses.NotFound = problemResponse("No encontrado.", 404, "not-found");
    return d;
  },
  "valid-capabilities.yaml": (d) => withAuth(withThings(d), things(d)),
  "valid-outcomes.yaml": (d) => withNotifyOrder(d),
  "valid-portal.yaml": (d) => withPortal(d),
  "valid-admin-path.yaml": (d) => {
    withThings(d);
    withScheme(d, "adminToken");
    withTag(d, things(d), "admin");
    things(d).security = [{ adminToken: [] }];
    things(d)["x-required-capabilities"] = ["flags:write"];
    things(d).responses["401"] = { $ref: "#/components/responses/Unauthorized" };
    d.components.responses.Unauthorized = problemResponse("No credential.", 401, "unauthorized");
    things(d).parameters = [
      {
        name: "merchantId",
        in: "path",
        required: true,
        description: "Merchant.",
        schema: { type: "string" },
      },
    ];
    d.paths["/v1/admin/merchants/{merchantId}/things"] = d.paths["/v1/things"];
    delete d.paths["/v1/things"];
    return d;
  },
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
    d.tags = [{ name: "misc", description: "Outside the catalogue." }];
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
  // FR-015 (a union wrapped in `type: object` is not closed there, but its branches are: a branch
  // abierta sigue fallando).
  "ope-request-closed-schema.union.yaml": (d) => {
    withThings(d);
    bodySchema(d).properties.meta = {
      type: "object",
      description: "Metadata per variant.",
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
      description: "Metadata per variant.",
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
      { name: "phone", in: "query", description: "Phone.", schema: { type: "string" } },
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
    health(d)["x-invariants"] = [{ type: "not-found", status: 404, description: "No rule." }];
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
  "ope-required-capabilities.foreign.yaml": (d) => {
    withPortal(d);
    d.paths["/v1/portal/decisions/{decisionId}"].get["x-required-capabilities"] = ["orders:write"];
    return d;
  },
  // ope-consumer-security (feature 006 FR-012, ADR-020)
  "ope-consumer-security.yaml": (d) => {
    withAuth(withThings(d), things(d));
    withScheme(d, "platformKey");
    things(d).security = [{ platformKey: [] }];
    return d;
  },
  "ope-consumer-security.public.yaml": (d) => {
    withAuth(withThings(d), things(d));
    health(d).security = [{ ingestKey: [] }];
    return d;
  },
  "ope-consumer-security.two-requirements.yaml": (d) => {
    withAuth(withThings(d), things(d));
    withScheme(d, "platformKey");
    things(d).security = [{ ingestKey: [] }, { platformKey: [] }];
    return d;
  },
  "ope-no-merchant-id-in-request.admin-body.yaml": (d) => {
    withThings(d);
    withScheme(d, "adminToken");
    withTag(d, things(d), "admin");
    things(d).security = [{ adminToken: [] }];
    things(d)["x-required-capabilities"] = ["flags:write"];
    things(d).responses["401"] = { $ref: "#/components/responses/Unauthorized" };
    d.components.responses.Unauthorized = problemResponse("No credential.", 401, "unauthorized");
    bodySchema(d).properties.merchantId = { type: "string", description: "Merchant." };
    return d;
  },
  // ope-outcomes-idempotency (feature 006 FR-021, ADR-020)
  "ope-outcomes-idempotency.yaml": (d) => {
    withNotifyOrder(d);
    delete orders(d)["x-idempotency"];
    return d;
  },
  "ope-outcomes-idempotency.key.yaml": (d) => {
    withNotifyOrder(d);
    orders(d)["x-idempotency"].key = "amountless";
    return d;
  },
  "ope-outcomes-idempotency.codes.yaml": (d) => {
    withNotifyOrder(d);
    orders(d)["x-idempotency"].repeat = "201";
    return d;
  },
  "ope-outcomes-idempotency.conflict.yaml": (d) => {
    withNotifyOrder(d);
    delete orders(d).responses["409"];
    delete d.components.responses.Conflict;
    return d;
  },
  // ope-collection-pagination (feature 006 FR-031, ADR-020)
  "ope-collection-pagination.yaml": (d) => {
    withPortal(d);
    delete decisions(d)["x-collection"];
    return d;
  },
  "ope-collection-pagination.params.yaml": (d) => {
    withPortal(d);
    decisions(d).parameters = [
      { name: "page", in: "query", description: "Page.", schema: { type: "integer" } },
      { name: "offset", in: "query", description: "Offset.", schema: { type: "integer" } },
    ];
    delete d.components.parameters;
    return d;
  },
  "ope-collection-pagination.envelope.yaml": (d) => {
    withPortal(d);
    decisions(d).responses["200"].content["application/json"].schema = {
      $ref: "#/components/schemas/Health",
    };
    delete d.components.schemas.DecisionPage;
    return d;
  },
};

for (const stale of readdirSync(out)) {
  if (stale.endsWith(".yaml") && !(stale in fixtures)) unlinkSync(path.join(out, stale));
}
for (const [file, mutate] of Object.entries(fixtures)) {
  const doc = mutate(base());
  const header = `# Fixture of tests/contract-rules: ${file.replace(/\.yaml$/, "")}. Generated by gen-fixtures.mjs from a minimal valid contract; violates only the rule in its name.\n`;
  writeFileSync(path.join(out, file), header + stringify(doc, { lineWidth: 0 }), "utf8");
}
console.log(`${Object.keys(fixtures).length} fixtures in ${out}`);
