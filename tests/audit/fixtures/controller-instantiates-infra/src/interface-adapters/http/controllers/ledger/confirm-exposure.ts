// Eval fixture: a controller that builds its own infrastructure (a validator from an npm package).
import { Ajv } from "ajv";

export function makeConfirmExposure(): (payload: unknown) => boolean {
  const validator = new Ajv({ allErrors: true });
  const validate = validator.compile({ type: "object" });
  return (payload) => validate(payload);
}
