// The merchant a request was authenticated as, whichever security scheme resolved it (the
// ingest key of the SDK or the platform key of the merchant's platform, ADR-025): what every
// controller reads and neither scheme owns.
import type { Merchant } from "../../../domain/merchant/index.js";
import type { Operator } from "../../../domain/operator/index.js";
import type { SecurityResults } from "../typed.js";

/** What a merchant security handler leaves for the controllers. */
export interface MerchantPrincipal {
  merchant: Merchant;
}

/** What the admin security handler leaves for the controllers (ADR-031). */
export interface OperatorPrincipal {
  operator: Operator;
}

/**
 * The authenticated merchant of the request. If missing, the wiring is broken (an operation
 * served without a merchant security handler): not a business case.
 */
export function merchantOf(req: { security: SecurityResults }): Merchant {
  const principal = Object.values(req.security).find((p) => typeof p === "object" && p !== null);
  if (principal !== undefined && "merchant" in principal) return (principal as MerchantPrincipal).merchant;
  throw new Error("The operation did not go through a merchant security handler.");
}

/**
 * The authenticated operator of the request. If missing, the wiring is broken (an admin
 * operation served without the admin security handler): not a business case.
 */
export function operatorOf(req: { security: SecurityResults }): Operator {
  const principal = Object.values(req.security).find((p) => typeof p === "object" && p !== null);
  if (principal !== undefined && "operator" in principal) return (principal as OperatorPrincipal).operator;
  throw new Error("The operation did not go through the admin security handler.");
}
