// US3 (FR-020, FR-022; ADR-023): Result is closed over DomainError, a switch over the codes of
// a response is exhaustive and `module` narrows. Verified with `npm run typecheck` (not executed).
import { SessionVisitorMismatch, type IngestionError } from "../../src/domain/ingestion/index.js";
import { LedgerUnavailable } from "../../src/domain/ledger/index.js";
import { fail, ok, type Result } from "../../src/domain/shared-kernel/index.js";
import { toProblem } from "../../src/interface-adapters/http/to-problem.js";

type Response = Result<number, IngestionError | LedgerUnavailable>;

export const success: Response = ok(1);
export const failure: Response = fail(new SessionVisitorMismatch("evt_1"));

// @ts-expect-error a plain Error is not a DomainError.
export const notAnError: Result<number, Error> = fail(new Error("x"));

// @ts-expect-error LedgerUnavailable is not in the declared union of the response.
export const outsideTheUnion: Result<number, IngestionError> = fail(new LedgerUnavailable());

// Exhaustive by code: the function has a return on every path only if every code is covered.
export function status(r: Response): number {
  if (r.ok) return 202;
  switch (r.error.code) {
    case "session-visitor-mismatch":
    case "event-timestamp-out-of-range":
      return 422;
    case "ledger-unavailable":
      return 503;
  }
}

// @ts-expect-error the union of codes is closed: a table without ledger-unavailable is incomplete.
export const incomplete: Record<(IngestionError | LedgerUnavailable)["code"], number> = {
  "session-visitor-mismatch": 422,
  "event-timestamp-out-of-range": 422,
};

export const origin = (r: Response): "ingestion" | "ledger" => (r.ok ? "ingestion" : r.error.module);

// The translation knows the status of each code: 422 for the invariants, 503 for the ledger.
export const translated: { status: 422 | 503 } = toProblem(new LedgerUnavailable(), "/v1/x");
// @ts-expect-error an invariant of the batch is never a 503.
export const wrongStatus: { status: 503 } = toProblem(new SessionVisitorMismatch("evt_1"), "/v1/x");
