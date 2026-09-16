// Use case: the credential identifies the merchant and the origin, if present, must be theirs.
// Returns a result, never throws: the HTTP adapter translates each reason to its Problem Details.
import { originAllowed, type Merchant } from "../../domain/merchant/index.js";
import type { MerchantDirectory } from "./ports/merchant-directory.js";

export interface ResolveIngestKeyInput {
  key: string | undefined;
  origin: string | undefined;
}

export type ResolveIngestKeyResult =
  { ok: true; merchant: Merchant } | { ok: false; reason: "unauthorized" | "origin-not-allowed" };

export type ResolveIngestKey = (input: ResolveIngestKeyInput) => ResolveIngestKeyResult;

export function makeResolveIngestKey(merchants: MerchantDirectory): ResolveIngestKey {
  return ({ key, origin }) => {
    const merchant = key === undefined ? undefined : merchants.findByIngestKey(key);
    if (!merchant) return { ok: false, reason: "unauthorized" };
    if (!originAllowed(merchant, origin)) return { ok: false, reason: "origin-not-allowed" };
    return { ok: true, merchant };
  };
}
