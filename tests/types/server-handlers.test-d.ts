// FR-046 / US2 scenario 7: a handler only compiles if it returns a declared status with the
// declared body. This file is verified with `npm run typecheck` (it is not executed).
import type { Handlers, OperationHandler } from "../../src/interface-adapters/http/typed.js";

// Compiles: 200 with a complete Health.
export const ok: OperationHandler<"getHealth"> = async () => ({
  status: 200,
  body: { status: "ok", contractVersion: "1.0.0", timestamp: "2026-09-16T12:00:00Z" },
});

// Compiles: 500 with Problem Details (declared in the contract).
export const problemResponse: OperationHandler<"getHealth"> = async () => ({
  status: 500,
  body: { type: "urn:ope:problem:internal-error", title: "Internal error", status: 500 },
});

// @ts-expect-error contractVersion and timestamp are missing in Health.
export const incomplete: OperationHandler<"getHealth"> = async () => ({
  status: 200,
  body: { status: "ok" },
});

// @ts-expect-error 201 is not declared for getHealth.
export const undeclaredStatus: OperationHandler<"getHealth"> = async () => ({
  status: 201,
  body: { status: "ok", contractVersion: "1.0.0", timestamp: "2026-09-16T12:00:00Z" },
});

// @ts-expect-error "down" is not a value of the status enum.
export const badEnum: OperationHandler<"getHealth"> = async () => ({
  status: 200,
  body: { status: "down", contractVersion: "1.0.0", timestamp: "2026-09-16T12:00:00Z" },
});

// @ts-expect-error the operation "doesNotExist" does not exist in the contract.
export const unknownOperation: Handlers = { doesNotExist: ok };
