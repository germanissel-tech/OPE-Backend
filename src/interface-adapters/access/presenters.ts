// What the access controllers share at the boundary: the operator as the contract publishes it
// (ADR-044) — its identifier, its display name when it has one, and its scope as configured.
import type { Operator } from "../../domain/operator/index.js";
import type { components } from "../http/typed.js";

type OperatorDto = components["schemas"]["Operator"];

export function operatorDto(operator: Operator): OperatorDto {
  return {
    operatorId: operator.operatorId,
    ...(operator.displayName === undefined ? {} : { displayName: operator.displayName }),
    scope: operator.scope === "*" ? "*" : [...operator.scope],
  };
}
