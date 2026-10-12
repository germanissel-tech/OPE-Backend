// What a platform is read with (feature 044, ADR-047; research R-02). Not the shape of the port: the port is the
// four use cases, and what a platform can give is never "what enters" in one call — Magento reads the children
// of a configurable apart, nobody answers "stock changed since T", a notice of VTEX only says what to read. Each
// platform writes a source with the reads `pull` and `subscribe` need, and the scheduler turns them into the
// requests of the use cases.
//
// What a source gives is already the domain's (ids branded, money as records): translating a platform is the
// source's work, and the scheduler only fills what the platform did not say — the instant, with the one of the
// observation.
import type { Product, VariantId } from "../../domain/catalog/index.js";
import type { OrderId, OrderItem } from "../../domain/outcomes/index.js";
import type { PlatformSourceName, SourceModes } from "../../domain/platform/index.js";
import type { MoneyRecord, MerchantId, SessionId } from "../../domain/shared-kernel/index.js";

export interface SourceCatalog {
  /** When the platform took the picture, if it says; otherwise the observation's. */
  capturedAt?: Date | undefined;
  products: readonly Product[];
}

export interface SourceStockAndPrice {
  variantId: VariantId;
  available: boolean;
  price: MoneyRecord;
  observedAt?: Date | undefined;
}

export interface SourceOrder {
  orderId: OrderId;
  /** As the platform spells it; the merchant's confirmation rule decides (research R-07). */
  state: string;
  total: MoneyRecord;
  items: readonly OrderItem[];
  /** When the platform moved it to this state, if it says. */
  confirmedAt?: Date | undefined;
  sessionId?: SessionId | undefined;
}

export interface SourceReturn {
  orderId: OrderId;
  returnedAt?: Date | undefined;
  items?: readonly OrderItem[] | undefined;
}

/** What changed since a cursor, and the cursor that follows it. */
export interface SourceChanges<T> {
  changes: readonly T[];
  cursor: string;
}

/** Every read throws when the platform does not answer: the scheduler records the run as failed. */
export interface PlatformSource {
  readonly modes: SourceModes;
  catalog(merchantId: MerchantId): Promise<SourceCatalog>;
  stockAndPrice(
    merchantId: MerchantId,
    variantIds: readonly VariantId[],
  ): Promise<readonly SourceStockAndPrice[]>;
  orderChanges(merchantId: MerchantId, cursor: string | undefined): Promise<SourceChanges<SourceOrder>>;
  returnChanges(merchantId: MerchantId, cursor: string | undefined): Promise<SourceChanges<SourceReturn>>;
  /** The order a notice is about, as the platform has it now; `undefined` if the platform does not have it. */
  order(merchantId: MerchantId, reference: string): Promise<SourceOrder | undefined>;
  /** The return of the order a notice is about; `undefined` if the platform has none. */
  returnOf(merchantId: MerchantId, reference: string): Promise<SourceReturn | undefined>;
}

/**
 * The sources this deployment installed (research R-08, R-09). `generic` is always there and reads nothing:
 * everything of a merchant on it arrives by `push`, so it has modes and no reader.
 */
export interface InstalledSources {
  /** What the configuration asks before it publishes; `undefined` when the source is not installed. */
  modesOf(source: PlatformSourceName): SourceModes | undefined;
  /** What the scheduler reads with; `undefined` for `generic` and for a source that is not installed. */
  readerOf(source: PlatformSourceName): PlatformSource | undefined;
}

const READS_NOTHING: SourceModes = { catalog: [], stockAndPrice: [], orders: [], returns: [] };

export function installedSources(readers: ReadonlyMap<PlatformSourceName, PlatformSource>): InstalledSources {
  return {
    modesOf: (source) => (source === "generic" ? READS_NOTHING : readers.get(source)?.modes),
    readerOf: (source) => readers.get(source),
  };
}
