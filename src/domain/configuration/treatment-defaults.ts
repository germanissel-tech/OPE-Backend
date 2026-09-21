// Level 2 of the configuration (constitution XI; ADR-031): what every merchant gets unless it
// declares otherwise. Travels with the release (`config/treatment-defaults.json`), read at
// start-up, changed with a deploy. Judged like any treatment: every value valid on its own.
// Never stored, so never rehydrated: the release file is the record.
import { fail, ok, type Result } from "../shared-kernel/index.js";
import { InvalidConfigurationValue } from "./errors.js";
import { TreatmentValues, type TreatmentValuesRecord } from "./treatment-values.js";

export interface TreatmentDefaultsRecord extends TreatmentValuesRecord {
  version: string;
}

export class TreatmentDefaults {
  readonly version: string;
  readonly values: TreatmentValues;

  private constructor(version: string, values: TreatmentValues) {
    this.version = version;
    this.values = values;
  }

  static of(record: TreatmentDefaultsRecord): Result<TreatmentDefaults, InvalidConfigurationValue> {
    if (record.version.trim() === "")
      return fail(new InvalidConfigurationValue("version", "must not be empty"));
    const values = TreatmentValues.judge(record);
    return values.ok ? ok(new TreatmentDefaults(record.version, values.value)) : fail(values.error);
  }

  record(): TreatmentDefaultsRecord {
    return { version: this.version, ...this.values.record() };
  }
}
