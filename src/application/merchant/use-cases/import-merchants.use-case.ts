// importMerchants (ADR-031): the seed of an empty environment (OPE_MERCHANTS) enters by the same
// door as the API — the same entity, the same rules, the same store — with the credentials the
// seed brings (fingerprinted here) on behalf of the system operator. A store that already holds
// merchants ignores the seed: it is a start, not a source of truth.
import { Merchant, type MerchantError } from "../../../domain/merchant/index.js";
import {
  asMerchantId,
  fail,
  ok,
  type Result,
  type StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import type { Operator } from "../../../domain/operator/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { CredentialMinter } from "../ports/credential-minter.js";
import type { MerchantStore } from "../ports/merchant-store.js";

/** A merchant as the seed describes it: identifiers and credentials in the clear. */
export interface MerchantSeed {
  merchantId: string;
  ingestKeys: readonly string[];
  origins: readonly string[];
  platformKeys: readonly string[];
  platformSecrets: readonly string[];
}

export interface ImportMerchantsRequest {
  actor: Operator;
  seeds: readonly MerchantSeed[];
}

/** What happened: imported (how many), or skipped because the store was not empty. */
export type ImportMerchantsResponse = Result<
  { imported: number } | { skipped: true },
  MerchantError | StoreUnavailable
>;

export interface ImportMerchantsDependencies {
  merchants: MerchantStore;
  minter: CredentialMinter;
  clock: Clock;
}

export class ImportMerchantsUseCase implements UseCase<ImportMerchantsRequest, ImportMerchantsResponse> {
  readonly #deps: ImportMerchantsDependencies;

  constructor(deps: ImportMerchantsDependencies) {
    this.#deps = deps;
  }

  async execute(request: ImportMerchantsRequest): Promise<ImportMerchantsResponse> {
    const { merchants, minter, clock } = this.#deps;
    if (!(await merchants.isEmpty())) return ok({ skipped: true });
    const now = clock.now();
    for (const seed of request.seeds) {
      const credentials = [
        ...(await Promise.all(
          seed.ingestKeys.map(async (k) => Merchant.credential("ingest", await minter.fingerprintOf(k), now)),
        )),
        ...(await Promise.all(
          seed.platformKeys.map(async (k) =>
            Merchant.credential("platform", await minter.fingerprintOf(k), now),
          ),
        )),
        ...(await Promise.all(
          seed.platformSecrets.map(async (s) =>
            Merchant.credential("signing", await minter.fingerprintOf(s), now, s),
          ),
        )),
      ];
      const merchant = Merchant.of({
        merchantId: asMerchantId(seed.merchantId),
        origins: seed.origins,
        credentials,
        createdAt: now,
      });
      if (!merchant.ok) return fail(merchant.error);
      const created = await merchants.create(merchant.value);
      if (!created.ok) return fail(created.error);
    }
    return ok({ imported: request.seeds.length });
  }
}
