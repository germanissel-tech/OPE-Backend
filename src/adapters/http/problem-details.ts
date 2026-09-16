// Problem Details (RFC 9457). Única forma de error de la API.
// Los tipos de problema replican contracts/problem-types.yaml (la fuente); una prueba verifica
// que ambos catálogos coinciden.
import type { components } from "../../generated/api.js";

export type ProblemDetails = components["schemas"]["ProblemDetails"];
export type ValidationError = NonNullable<ProblemDetails["errors"]>[number];

export const PROBLEM_CONTENT_TYPE = "application/problem+json";
export const PROBLEM_NAMESPACE = "urn:ope:problem:";

export const PROBLEM_TYPES = {
  "validation-failed": { status: 400, title: "El request no cumple el contrato" },
  unauthorized: { status: 401, title: "Credencial ausente o inválida" },
  "not-found": { status: 404, title: "Ruta no declarada en el contrato" },
  "method-not-allowed": { status: 405, title: "Método no declarado para la ruta" },
  unprocessable: { status: 422, title: "Request válido rechazado por semántica" },
  "internal-error": { status: 500, title: "Error interno" },
  "response-contract-violation": { status: 500, title: "La respuesta del manejador no cumple el contrato" },
  "not-implemented": { status: 501, title: "Operación declarada sin manejador" },
} as const satisfies Record<string, { status: number; title: string }>;

export type ProblemSlug = keyof typeof PROBLEM_TYPES;

export interface ProblemOptions {
  detail?: string;
  instance?: string;
  errors?: ValidationError[];
}

export interface ProblemResponse {
  status: number;
  body: ProblemDetails;
}

/** Construye la respuesta de error para un tipo del catálogo. Nunca incluye detalles internos. */
export function problem(slug: ProblemSlug, options: ProblemOptions = {}): ProblemResponse {
  const { status, title } = PROBLEM_TYPES[slug];
  const body: ProblemDetails = { type: `${PROBLEM_NAMESPACE}${slug}`, title, status };
  if (options.detail !== undefined) body.detail = options.detail;
  if (options.instance !== undefined) body.instance = options.instance;
  if (options.errors !== undefined) body.errors = options.errors;
  return { status, body };
}
