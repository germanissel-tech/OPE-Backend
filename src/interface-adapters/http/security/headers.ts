// The credential header of a request, as a security handler reads it: the first value if
// repeated, undefined if absent.
import type { SecurityRequest } from "../typed.js";

export function header(headers: SecurityRequest["headers"], name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}
