// The credential header of a request, as a security handler reads it: the first value if
// repeated, undefined if absent.
import type { SecurityRequest } from "../typed.js";

export function header(headers: SecurityRequest["headers"], name: string): string | undefined {
  const value = headers[name];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return undefined;
}
