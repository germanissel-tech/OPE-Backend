// `res.json()` of fastify.inject returns `any`; this helper replaces it with `unknown` typed
// explicitly by the caller.
import type { LightMyRequestResponse } from "fastify";

export function json(res: LightMyRequestResponse): unknown {
  return JSON.parse(res.body) as unknown;
}

/** Error body parsed and verified at runtime as Problem Details. */
export function problemOf(res: LightMyRequestResponse): ProblemBody {
  const body = json(res);
  if (typeof body !== "object" || body === null || !("type" in body) || !("status" in body)) {
    throw new Error(`Not Problem Details: ${res.body}`);
  }
  return body as ProblemBody;
}

/** Problem Details as the tests compare it. */
export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: { pointer: string; message: string }[];
}
