// Where each flow of a merchant stands, on the durable store (feature 044; research R-10): `platform_sync`, one
// row per merchant and flow. Durable so a restart resumes the stock-and-price cycle and the change cursors where
// they were; the store decides first or replace by its unique key, not a read before the write.
import {
  fetched,
  fromDocument,
  stored,
  toDocument,
  type DurableGatewayDeps,
} from "../../shared-kernel/index.js";
import type { SyncStateStore } from "../../../application/platform/index.js";
import type { SyncState } from "../../../domain/platform/index.js";
import type { SyncFlow } from "../../../domain/shared-kernel/index.js";

const OF_MERCHANT = `SELECT flow, document FROM platform_sync WHERE merchant_id = :merchant`;

const SAVE = `INSERT INTO platform_sync (merchant_id, flow, document) VALUES (:merchant, :flow, :document)
  ON CONFLICT (merchant_id, flow) DO UPDATE SET document = excluded.document,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

export function sqliteSyncStateStore(deps: DurableGatewayDeps): SyncStateStore {
  return {
    statesOf: (merchantId) =>
      fetched(deps, () =>
        Object.fromEntries(
          deps.store
            .all(OF_MERCHANT, { merchant: merchantId })
            // The cast is true: the document was written from a state this code built, and a state is a value
            // whose dates come back marked (`fromDocument`).
            .map((row) => [
              String(row["flow"]) as SyncFlow,
              fromDocument(String(row["document"])) as SyncState,
            ]),
        ),
      ),
    save: (merchantId, flow, state) =>
      stored(deps, "platform sync", () => {
        deps.store.run(SAVE, { merchant: merchantId, flow, document: toDocument(state) });
        return undefined;
      }),
  };
}
