// How often the scheduler pulls each flow of a merchant, and how many variants a stock-and-price batch
// reads (ADR-047). The values are configuration (constitution XI); what lives here is that each one is a
// positive integer.
import { fail, ok, type Result } from "../shared-kernel/index.js";
import { InvalidSyncCadence } from "./errors.js";

export interface SyncCadenceRecord {
  catalogMs: number;
  stockAndPriceMs: number;
  stockAndPriceBatchSize: number;
  ordersMs: number;
  returnsMs: number;
}

const FIELDS = ["catalogMs", "stockAndPriceMs", "stockAndPriceBatchSize", "ordersMs", "returnsMs"] as const;

export class SyncCadence {
  readonly catalogMs: number;
  readonly stockAndPriceMs: number;
  readonly stockAndPriceBatchSize: number;
  readonly ordersMs: number;
  readonly returnsMs: number;

  private constructor(record: SyncCadenceRecord) {
    this.catalogMs = record.catalogMs;
    this.stockAndPriceMs = record.stockAndPriceMs;
    this.stockAndPriceBatchSize = record.stockAndPriceBatchSize;
    this.ordersMs = record.ordersMs;
    this.returnsMs = record.returnsMs;
  }

  static of(record: SyncCadenceRecord): Result<SyncCadence, InvalidSyncCadence> {
    const offence = FIELDS.find((field) => !Number.isInteger(record[field]) || record[field] < 1);
    return offence === undefined ? ok(new SyncCadence(record)) : fail(new InvalidSyncCadence(offence));
  }

  static rehydrate(record: SyncCadenceRecord): SyncCadence {
    return new SyncCadence(record);
  }

  record(): SyncCadenceRecord {
    return {
      catalogMs: this.catalogMs,
      stockAndPriceMs: this.stockAndPriceMs,
      stockAndPriceBatchSize: this.stockAndPriceBatchSize,
      ordersMs: this.ordersMs,
      returnsMs: this.returnsMs,
    };
  }
}
