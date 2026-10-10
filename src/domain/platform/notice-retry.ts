// How a notice whose read failed is retried (ADR-047): the wait between attempts and how many are made
// before the notice is dropped with a trace. Configuration (constitution XI); here, that both are positive
// integers.
import { fail, ok, type Result } from "../shared-kernel/index.js";
import { InvalidNoticeRetry } from "./errors.js";

export interface NoticeRetryRecord {
  afterMs: number;
  maxAttempts: number;
}

const FIELDS = ["afterMs", "maxAttempts"] as const;

export class NoticeRetry {
  readonly afterMs: number;
  readonly maxAttempts: number;

  private constructor(record: NoticeRetryRecord) {
    this.afterMs = record.afterMs;
    this.maxAttempts = record.maxAttempts;
  }

  static of(record: NoticeRetryRecord): Result<NoticeRetry, InvalidNoticeRetry> {
    const offence = FIELDS.find((field) => !Number.isInteger(record[field]) || record[field] < 1);
    return offence === undefined ? ok(new NoticeRetry(record)) : fail(new InvalidNoticeRetry(offence));
  }

  static rehydrate(record: NoticeRetryRecord): NoticeRetry {
    return new NoticeRetry(record);
  }

  record(): NoticeRetryRecord {
    return { afterMs: this.afterMs, maxAttempts: this.maxAttempts };
  }
}
