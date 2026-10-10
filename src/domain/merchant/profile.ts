// The identity of a merchant for people (ADR-045): the name of the store, its URL, the person the
// relationship is handled with and the operator's notes. A value of the aggregate, not an aggregate:
// it lives in the merchant's record and changes whole. The schema already judged lengths and
// formats; what is judged here is what a schema cannot say legibly — a text padded with whitespace,
// a URL that only looks like one — and a value is kept as written, never trimmed.
import { fail, ok, type Result } from "../shared-kernel/index.js";
import { InvalidMerchantProfile } from "./errors.js";

/** The person the merchant relationship is handled with: an identified party, never an observed one. */
export interface MerchantContactRecord {
  name: string;
  email: string;
  phone?: string | undefined;
  role?: string | undefined;
}

export interface MerchantProfileRecord {
  displayName?: string | undefined;
  storeUrl?: string | undefined;
  contact?: MerchantContactRecord | undefined;
  notes?: string | undefined;
}

/** The schemes a store URL may have: it is for a person to open in a browser. */
const STORE_URL_SCHEMES = ["http:", "https:"];

/** Blank, or with whitespace at either end: not what the operator meant to show. */
const isPadded = (text: string): boolean => text.trim() !== text || text === "";

/**
 * An absolute http(s) URL, as written: the pattern of the schema only looks at the prefix. A host is
 * not checked apart: for these schemes the parser refuses a URL without one (`https://` does not parse).
 */
function isStoreUrl(text: string): boolean {
  if (isPadded(text) || !URL.canParse(text)) return false;
  return STORE_URL_SCHEMES.includes(new URL(text).protocol);
}

export class MerchantProfile implements MerchantProfileRecord {
  readonly displayName: string | undefined;
  readonly storeUrl: string | undefined;
  readonly contact: MerchantContactRecord | undefined;
  readonly notes: string | undefined;

  private constructor(record: MerchantProfileRecord) {
    this.displayName = record.displayName;
    this.storeUrl = record.storeUrl;
    this.contact = record.contact === undefined ? undefined : { ...record.contact };
    this.notes = record.notes;
  }

  /** An identity as written: no text padded or blank, and a store URL that parses as one. The first rule broken names its field. */
  static of(record: MerchantProfileRecord): Result<MerchantProfile, InvalidMerchantProfile> {
    const field = MerchantProfile.firstInvalid(record);
    return field === undefined ? ok(new MerchantProfile(record)) : fail(new InvalidMerchantProfile(field));
  }

  /** The field of the first rule broken, in the order the fields are written, or none. */
  private static firstInvalid(record: MerchantProfileRecord): string | undefined {
    if (record.displayName !== undefined && isPadded(record.displayName)) return "displayName";
    if (record.storeUrl !== undefined && !isStoreUrl(record.storeUrl)) return "storeUrl";
    if (record.contact !== undefined) {
      if (isPadded(record.contact.name)) return "contact.name";
      if (isPadded(record.contact.email)) return "contact.email";
    }
    if (record.notes?.trim() === "") return "notes";
    return undefined;
  }

  /** An identity a store already kept: its facts are not re-judged (ADR-024). */
  static rehydrate(record: MerchantProfileRecord): MerchantProfile {
    return new MerchantProfile(record);
  }

  /**
   * Whether another identity says the same, field by field (feature 043): what lets the retry of an edition
   * that went through answer as before instead of being refused for a witness it already moved. Field by
   * field and not by the shape of the record, so the order in which a body listed them does not count.
   */
  sameAs(other: MerchantProfile | undefined): boolean {
    if (other === undefined) return false;
    const [mine, theirs] = [this.contact, other.contact];
    const sameContact =
      mine === undefined || theirs === undefined
        ? mine === theirs
        : mine.name === theirs.name &&
          mine.email === theirs.email &&
          mine.phone === theirs.phone &&
          mine.role === theirs.role;
    return (
      this.displayName === other.displayName &&
      this.storeUrl === other.storeUrl &&
      this.notes === other.notes &&
      sameContact
    );
  }

  /** The record as a store would keep it; an absent field stays absent. */
  record(): MerchantProfileRecord {
    return {
      displayName: this.displayName,
      storeUrl: this.storeUrl,
      contact: this.contact === undefined ? undefined : { ...this.contact },
      notes: this.notes,
    };
  }
}
