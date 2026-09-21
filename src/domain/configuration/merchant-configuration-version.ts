// Level 3 of the configuration (01 §14.2; constitution XI; ADR-031): what a merchant overrides,
// published as numbered, immutable versions. A version declares values and, optionally, the
// anchor map; it says whether it is corrective (the only kind allowed while an experiment is
// active, 03 §4.10) and why. Its own rules are here; the values are judged once resolved over
// the treatment defaults (EffectiveConfiguration).
import { fail, ok, type MerchantId, type Result } from "../shared-kernel/index.js";
import { AnchorMap, type AnchorMapRecord } from "./anchor-map.js";
import { ConfigurationReasonRequired, type InvalidConfigurationValue } from "./errors.js";
import type { DeclaredTreatmentValues } from "./treatment-values.js";
import type { OperatorId } from "../operator/index.js";

export interface DeclaredConfiguration extends DeclaredTreatmentValues {
  anchors?: AnchorMapRecord;
}

/** What is published: everything but the number, which the store assigns. */
export interface ConfigurationDraft {
  merchantId: MerchantId;
  declared: DeclaredConfiguration;
  corrective: boolean;
  reason?: string;
  publishedAt: Date;
  operatorId: OperatorId;
}

export interface MerchantConfigurationVersionRecord extends ConfigurationDraft {
  version: number;
}

export type VersionError = ConfigurationReasonRequired | InvalidConfigurationValue;

/** The canonical text of the declared values: what two versions compare by. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  // An object (never null: the declared values carry none), whose keys are ordered.
  if (Object(value) === value) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export class MerchantConfigurationVersion {
  readonly merchantId: MerchantId;
  readonly version: number;
  readonly declared: DeclaredConfiguration;
  readonly corrective: boolean;
  readonly reason: string | undefined;
  readonly publishedAt: Date;
  readonly operatorId: OperatorId;

  private constructor(record: MerchantConfigurationVersionRecord) {
    this.merchantId = record.merchantId;
    this.version = record.version;
    this.declared = record.declared;
    this.corrective = record.corrective;
    this.reason = record.reason;
    this.publishedAt = record.publishedAt;
    this.operatorId = record.operatorId;
  }

  /**
   * A draft the merchant may publish: a corrective version carries a reason, and the anchor map,
   * which has no default to resolve against, is judged here. The values are judged by the
   * resolution.
   */
  static draft(input: ConfigurationDraft): Result<ConfigurationDraft, VersionError> {
    if (input.corrective && (input.reason === undefined || input.reason.trim() === "")) {
      return fail(new ConfigurationReasonRequired());
    }
    if (input.declared.anchors !== undefined) {
      const anchors = AnchorMap.of(input.declared.anchors);
      if (!anchors.ok) return fail(anchors.error);
    }
    return ok(input);
  }

  /** The draft with the number the store assigned. */
  static numbered(draft: ConfigurationDraft, version: number): MerchantConfigurationVersion {
    return new MerchantConfigurationVersion({ ...draft, version });
  }

  static rehydrate(record: MerchantConfigurationVersionRecord): MerchantConfigurationVersion {
    return new MerchantConfigurationVersion(record);
  }

  /** Publishing what the version in force already declares repeats it (ADR-020): identity by content. */
  sameContentAs(draft: ConfigurationDraft): boolean {
    return (
      canonical(this.declared) === canonical(draft.declared) &&
      this.corrective === draft.corrective &&
      this.reason === draft.reason
    );
  }

  anchorMap(): AnchorMap | undefined {
    return this.declared.anchors === undefined ? undefined : AnchorMap.rehydrate(this.declared.anchors);
  }

  record(): MerchantConfigurationVersionRecord {
    return {
      merchantId: this.merchantId,
      version: this.version,
      declared: this.declared,
      corrective: this.corrective,
      ...(this.reason === undefined ? {} : { reason: this.reason }),
      publishedAt: this.publishedAt,
      operatorId: this.operatorId,
    };
  }
}
