// Fixture de tests/lint: viola sólo la regla que lleva en el nombre.
import { Clock } from "../../../src/ports/clock.js";
export function at(c: Clock): Date {
  return c.now();
}
