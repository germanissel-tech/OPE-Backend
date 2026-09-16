// Every operation the contract declares must be served by a module, or the process does not
// start (constitution II, fail-closed): a controller written and never wired is found at boot,
// not by a 501 in production. The server itself keeps the 501 for arbitrary handler maps (FR-044).
import type { ContractDocument } from "../infrastructure/http/build-server.js";
import type { Handlers } from "../interface-adapters/http/typed.js";

const HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;

/** The `operationId`s declared in the contract that `handlers` does not serve, in contract order. */
export function unwiredOperations(definition: ContractDocument, handlers: Handlers): string[] {
  const missing: string[] = [];
  for (const item of Object.values(definition.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operationId = item?.[method]?.operationId;
      if (operationId !== undefined && !(operationId in handlers)) missing.push(operationId);
    }
  }
  return missing;
}

export function assertEveryOperationWired(definition: ContractDocument, handlers: Handlers): void {
  const missing = unwiredOperations(definition, handlers);
  if (missing.length > 0) {
    throw new Error(
      `The contract declares operations no module wires: ${missing.join(", ")}. ` +
        "Serve each one from its module in src/composition/modules/ (fail-closed at boot).",
    );
  }
}
