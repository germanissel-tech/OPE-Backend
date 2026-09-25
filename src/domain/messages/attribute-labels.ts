// What a merchant's own labels correspond to in OPE's vocabulary (feature 027; 01 §14.2): the same
// mechanism as the anchor map — OPE fixes the small vocabulary and each store maps its world onto
// it. Only exists valid: if you hold one, every value is one OPE writes for and no label says two
// things.
import { fail, ok, type Result } from "../shared-kernel/index.js";
import { ATTRIBUTE_VALUES, type AttributeValue } from "./attribute-values.js";
import { DuplicateAttributeLabel, UnknownAttributeValue } from "./errors.js";

/** The two ways a correspondence can be wrong, and no other: the caller narrows nothing (ADR-023). */
export type AttributeLabelsError = DuplicateAttributeLabel | UnknownAttributeValue;

/** One label of the merchant and the value it corresponds to, as it is declared. */
export interface AttributeLabelRecord {
  label: string;
  value: string;
}

export class AttributeLabels {
  readonly #byLabel: ReadonlyMap<string, AttributeValue>;

  private constructor(byLabel: ReadonlyMap<string, AttributeValue>) {
    this.#byLabel = byLabel;
  }

  /** Several labels may point at one value; one label at one only, or nothing could be said. */
  static of(records: readonly AttributeLabelRecord[]): Result<AttributeLabels, AttributeLabelsError> {
    const byLabel = new Map<string, AttributeValue>();
    for (const { label, value } of records) {
      if (!isAttributeValue(value)) return fail(new UnknownAttributeValue(value));
      if (byLabel.has(label)) return fail(new DuplicateAttributeLabel(label));
      byLabel.set(label, value);
    }
    return ok(new AttributeLabels(byLabel));
  }

  /** A merchant that declared nothing: no product says anything of its attributes. */
  static empty(): AttributeLabels {
    return new AttributeLabels(new Map());
  }

  /** A correspondence already judged when its version was published; its rules are not re-evaluated. */
  static rehydrate(records: readonly AttributeLabelRecord[]): AttributeLabels {
    return new AttributeLabels(new Map(records.map(({ label, value }) => [label, value as AttributeValue])));
  }

  /** Every label the merchant declared: what a report of what it did not declare has to exclude. */
  labels(): ReadonlySet<string> {
    return new Set(this.#byLabel.keys());
  }

  /** What the merchant's label means to OPE, or undefined when it mapped nothing to it. */
  valueOf(label: string): AttributeValue | undefined {
    return this.#byLabel.get(label);
  }
}

const isAttributeValue = (value: string): value is AttributeValue =>
  (ATTRIBUTE_VALUES as readonly string[]).includes(value);
