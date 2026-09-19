// Feature 015 (F-038; ADR-027): `Claim` is a union closed by `kind`. A claim class the gate does
// not judge does not compile, and a claim is never a bare string. Verified with `npm run typecheck`
// (not executed).
import type { Claim, ClaimKind } from "../../src/domain/selection/index.js";

/** What the gate must answer for every kind: adding a kind to `Claim` fails here until it is judged. */
const JUDGED: Record<ClaimKind, true> = {
  "returns-policy": true,
  "fit-data": true,
  "current-price": true,
  availability: true,
  incentive: true,
  "product-attribute": true,
};
export const judgedKinds = Object.keys(JUDGED);

export const attribute: Claim = { kind: "product-attribute", key: "material" };

// @ts-expect-error a claim is an object discriminated by kind, never a bare string.
export const bare: Claim = "returns-policy";

// @ts-expect-error a kind outside the closed vocabulary does not compile.
export const stranger: Claim = { kind: "social-proof" };

// @ts-expect-error an attribute claim names its key.
export const keyless: Claim = { kind: "product-attribute" };

// Exhaustive by kind: the function has a return on every path only if every kind is covered.
export function classOf(claim: Claim): string {
  switch (claim.kind) {
    case "returns-policy":
    case "fit-data":
      return "merchant";
    case "current-price":
    case "availability":
      return "catalogue";
    case "incentive":
      return "policy";
    case "product-attribute":
      return claim.key;
  }
}
