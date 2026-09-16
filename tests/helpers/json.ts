// `res.json()` de fastify.inject devuelve `any`; este helper lo reemplaza por `unknown` tipado
// explícitamente por quien lo llama.
import type { LightMyRequestResponse } from "fastify";

export function json(res: LightMyRequestResponse): unknown {
  return JSON.parse(res.body) as unknown;
}

/** Cuerpo de error parseado y verificado en runtime como Problem Details. */
export function problemOf(res: LightMyRequestResponse): ProblemBody {
  const body = json(res);
  if (typeof body !== "object" || body === null || !("type" in body) || !("status" in body)) {
    throw new Error(`No es Problem Details: ${res.body}`);
  }
  return body as ProblemBody;
}

/** Problem Details tal como lo comparan las pruebas. */
export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: { pointer: string; message: string }[];
}
