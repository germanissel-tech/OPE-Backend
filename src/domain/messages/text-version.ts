// A version of a text (feature 038): what a key says in one layer at one moment, numbered by the store,
// immutable, and the thing an intervention stamps. It is the level version one layer sideways: the same
// two rules —a corrective version carries its reason, an identical text repeats instead of creating— plus
// the one that is its own: **only a merchant's layer may say «removed»**, because the base has to stay
// complete for every supported language.
//
// Its record declares the text as plain data and the constructor turns it into a `CuratedText` (feature
// 037), with the identifier of the version minted from the layer, the key and the number: so the identifier
// cannot lie, and a corrected text keeps the one a person actually read in the ledger.
import {
  ConfigurationReasonRequired,
  fail,
  ok,
  type MerchantId,
  type Result,
} from "../shared-kernel/index.js";
import { CuratedText } from "./curated-text.js";
import { BaseTextRequired, type MessageError } from "./errors.js";
import { messageVersion, type MessageVersion } from "./ids.js";
import { TextKey, type TextKeyRecord } from "./text-key.js";
import type { OperatorId } from "../operator/index.js";

/** What stands for the base layer wherever a layer is written as one string. */
const BASE = "base";

/** What is published: everything but the number, which the store assigns. */
export interface TextDraft {
  key: TextKeyRecord;
  /** The merchant whose layer this is; absent for the base. */
  merchantId?: MerchantId;
  /** The text, already as a person would read it; absent when the version removes the merchant's text. */
  text?: string;
  corrective: boolean;
  reason?: string;
  publishedAt: Date;
  operatorId: OperatorId;
}

export interface TextVersionRecord extends TextDraft {
  version: number;
}

export class TextVersion {
  readonly key: TextKey;
  readonly merchantId?: MerchantId;
  readonly version: number;
  readonly text?: CuratedText;
  readonly corrective: boolean;
  readonly reason: string | undefined;
  readonly publishedAt: Date;
  readonly operatorId: OperatorId;

  private constructor(record: TextVersionRecord) {
    this.key = TextKey.rehydrate(record.key);
    if (record.merchantId !== undefined) this.merchantId = record.merchantId;
    this.version = record.version;
    if (record.text !== undefined) {
      this.text = CuratedText.rehydrate({ version: this.messageVersionId(), value: record.text });
    }
    this.corrective = record.corrective;
    this.reason = record.reason;
    this.publishedAt = record.publishedAt;
    this.operatorId = record.operatorId;
  }

  /**
   * A draft an operator may publish: the key is one of the vocabulary, a corrective draft carries a reason
   * that is not blank, the text —when there is one— is a curated text, and only a merchant's layer may
   * remove. The text comes back trimmed, which is what the store keeps and what a repetition compares.
   */
  static draft(input: TextDraft): Result<TextDraft, MessageError | ConfigurationReasonRequired> {
    const key = TextKey.of(input.key);
    if (!key.ok) return key;
    if (input.corrective && (input.reason === undefined || input.reason.trim() === "")) {
      return fail(new ConfigurationReasonRequired());
    }
    if (input.text === undefined) {
      return input.merchantId === undefined
        ? fail(new BaseTextRequired())
        : ok({ ...input, key: key.value.record() });
    }
    // Judged with a provisional identifier: the number is the store's, and the rules of a text do not
    // depend on it.
    const judged = CuratedText.of(messageVersion("draft"), input.text);
    if (!judged.ok) return judged;
    return ok({ ...input, key: key.value.record(), text: judged.value.value });
  }

  /** The draft with the number the store assigned. */
  static numbered(draft: TextDraft, version: number): TextVersion {
    return new TextVersion({ ...draft, version });
  }

  static rehydrate(record: TextVersionRecord): TextVersion {
    return new TextVersion(record);
  }

  /** Whether this version removes the layer's text for the key, so the key resolves to the base. */
  isRemoved(): boolean {
    return this.text === undefined;
  }

  /**
   * Publishing what the version in force already says repeats it instead of creating another (FR-003): the
   * same text, the same corrective flag and the same reason. Removing what is already removed repeats too.
   */
  sameTextAs(draft: TextDraft): boolean {
    const text = draft.text === undefined ? undefined : draft.text.trim();
    return this.text?.value === text && this.corrective === draft.corrective && this.reason === draft.reason;
  }

  /**
   * The identifier an intervention stamps and the ledger keeps (constitution IX): layer, key and number,
   * minted and never declared, so «version 3» of one key cannot be mistaken for version 3 of another.
   */
  messageVersionId(): MessageVersion {
    return messageVersion(`${this.merchantId ?? BASE}/${this.key.toString()}#${this.version}`);
  }

  record(): TextVersionRecord {
    return {
      key: this.key.record(),
      ...(this.merchantId === undefined ? {} : { merchantId: this.merchantId }),
      version: this.version,
      ...(this.text === undefined ? {} : { text: this.text.value }),
      corrective: this.corrective,
      ...(this.reason === undefined ? {} : { reason: this.reason }),
      publishedAt: this.publishedAt,
      operatorId: this.operatorId,
    };
  }
}
