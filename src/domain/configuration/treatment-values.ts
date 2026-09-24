// The values of a treatment (constitution XI; ADR-031): what the treatment defaults declare for
// every merchant and what a merchant's effective configuration resolves to. One judge for both:
// the defaults are judged as they are; a merchant version is judged once merged over them,
// value by value. Every rule of a value lives with its owner (freshness and sync level in the
// catalogue, the policies in theirs); here the vocabularies of the configuration and the merge.
import {
  FreshnessBudget,
  SyncLevelRules,
  type FreshnessBudgetRecord,
  type SyncLevelRulesRecord,
} from "../catalog/index.js";
import { Experiment } from "../experiment/index.js";
import { isRate, BARRIERS, fail, ok, type Barrier, type Result } from "../shared-kernel/index.js";
import { InvalidConfigurationValue } from "./errors.js";
import {
  PolicyInput,
  type CommercialPolicyDeclared,
  type CommercialPolicyInput,
  type DecisionPolicyDeclared,
  type DecisionPolicyInput,
  type EvidenceProfileDeclared,
  type EvidenceProfileInput,
} from "./policy-inputs.js";
import {
  LOCALE_PATTERN,
  SURFACES,
  SYNC_FLOWS,
  SYNC_MODES,
  type Locales,
  type Surface,
  type SyncStrategy,
} from "./vocabulary.js";
import type { CommercialPolicy } from "../commercial/index.js";
import type { DecisionPolicy } from "../decision/index.js";

/** The field the holdout is declared under, and the pointer both of its rules report. */
const HOLDOUT = "holdoutShare";

/** The values as the configuration speaks them (shares, milliseconds, closed vocabularies). */
export interface TreatmentValuesRecord {
  freshness: FreshnessBudgetRecord;
  syncLevel: SyncLevelRulesRecord;
  /** Share of the traffic kept out of every experiment, as a fraction of 1; 0 is allowed. */
  holdoutShare: number;
  decisionPolicy: DecisionPolicyInput;
  commercialPolicy: CommercialPolicyInput;
  evidenceProfile: EvidenceProfileInput;
  surfaces: readonly Surface[];
  barriers: readonly Barrier[];
  syncStrategy: SyncStrategy;
  locales: Locales;
}

/** What a merchant overrides: any value, partially where the value has parts. */
export interface DeclaredTreatmentValues {
  freshness?: Partial<FreshnessBudgetRecord>;
  syncLevel?: Partial<SyncLevelRulesRecord>;
  holdoutShare?: number;
  decisionPolicy?: DecisionPolicyDeclared;
  commercialPolicy?: CommercialPolicyDeclared;
  evidenceProfile?: EvidenceProfileDeclared;
  surfaces?: readonly Surface[];
  barriers?: readonly Barrier[];
  syncStrategy?: Partial<SyncStrategy>;
  locales?: Locales;
}

export type TreatmentResult<T> = Result<T, InvalidConfigurationValue>;

/** A closed list: non-empty, without repeats, every element of the vocabulary. */
function judgeList(
  values: readonly string[],
  vocabulary: readonly string[],
  at: string,
): InvalidConfigurationValue | undefined {
  if (values.length === 0) return new InvalidConfigurationValue(at, "must not be empty");
  const unknown = values.findIndex((v) => !vocabulary.includes(v));
  if (unknown >= 0)
    return new InvalidConfigurationValue(`${at}[${unknown}]`, `must be one of ${vocabulary.join(", ")}`);
  if (new Set(values).size !== values.length)
    return new InvalidConfigurationValue(at, "must not repeat a value");
  return undefined;
}

function judgeLocales(locales: Locales, at: string): InvalidConfigurationValue | undefined {
  const bad = locales.supported.findIndex((tag) => !LOCALE_PATTERN.test(tag));
  if (bad >= 0)
    return new InvalidConfigurationValue(`${at}.supported[${bad}]`, "must be a BCP 47 language tag");
  if (new Set(locales.supported).size !== locales.supported.length) {
    return new InvalidConfigurationValue(`${at}.supported`, "must not repeat a language");
  }
  if (locales.fallback !== undefined && !locales.supported.includes(locales.fallback)) {
    return new InvalidConfigurationValue(`${at}.fallback`, "must be one of the supported languages");
  }
  return undefined;
}

/** A rejection of a catalogue rule, at the field of the configuration that fed it. */
const located = (at: string, error: { path: string; message: string }): InvalidConfigurationValue =>
  new InvalidConfigurationValue(`${at}.${error.path}`, error.message);

export class TreatmentValues {
  readonly freshness: FreshnessBudget;
  readonly syncLevel: SyncLevelRules;
  /** The holdout as a share of 1, the way the configuration declares it. */
  readonly holdoutShare: number;
  readonly decisionPolicy: DecisionPolicy;
  readonly commercialPolicy: CommercialPolicy;
  readonly evidenceProfile: EvidenceProfileInput;
  readonly surfaces: readonly Surface[];
  readonly barriers: readonly Barrier[];
  readonly syncStrategy: SyncStrategy;
  readonly locales: Locales;
  readonly #record: TreatmentValuesRecord;

  private constructor(
    record: TreatmentValuesRecord,
    built: {
      freshness: FreshnessBudget;
      syncLevel: SyncLevelRules;
      decision: DecisionPolicy;
      commercial: CommercialPolicy;
    },
  ) {
    this.#record = record;
    this.freshness = built.freshness;
    this.syncLevel = built.syncLevel;
    this.holdoutShare = record.holdoutShare;
    this.decisionPolicy = built.decision;
    this.commercialPolicy = built.commercial;
    this.evidenceProfile = {
      ...record.evidenceProfile,
      authorizedAttributes: [...record.evidenceProfile.authorizedAttributes],
    };
    this.surfaces = [...record.surfaces];
    this.barriers = [...record.barriers];
    this.syncStrategy = { ...record.syncStrategy };
    this.locales = {
      supported: [...record.locales.supported],
      ...(record.locales.fallback === undefined ? {} : { fallback: record.locales.fallback }),
    };
  }

  /** Every value judged by its owner; the first offence names its field from the root of the record. */
  static judge(record: TreatmentValuesRecord): TreatmentResult<TreatmentValues> {
    const freshness = FreshnessBudget.of(record.freshness);
    if (!freshness.ok) return fail(located("freshness", freshness.error));
    const syncLevel = SyncLevelRules.of(record.syncLevel);
    if (!syncLevel.ok) return fail(located("syncLevel", syncLevel.error));
    // The same judge every other share of the system uses; there is no second reading of what a
    // share is (feature 022).
    if (!isRate(record.holdoutShare)) {
      return fail(new InvalidConfigurationValue(HOLDOUT, "must be a fraction between 0 and 1"));
    }
    // The holdout is compared against the split in whole buckets, so it has to be one the split can
    // hand out: a holdout of 0.004 resolves to none, and the merchant would keep nobody out while
    // believing otherwise. The rule is asked of the split, which owns the resolution (feature 023).
    if (!Experiment.handsOut(record.holdoutShare)) {
      const problem = "must be one of the buckets the assignment splits the visitors into";
      return fail(new InvalidConfigurationValue(HOLDOUT, problem));
    }
    const decision = PolicyInput.at("decisionPolicy").decision(record.decisionPolicy);
    if (!decision.ok) return fail(decision.error);
    const commercial = PolicyInput.at("commercialPolicy").commercial(record.commercialPolicy);
    if (!commercial.ok) return fail(commercial.error);
    const offence =
      judgeList(record.surfaces, SURFACES, "surfaces") ??
      judgeList(record.barriers, BARRIERS, "barriers") ??
      TreatmentValues.judgeStrategy(record.syncStrategy) ??
      judgeLocales(record.locales, "locales");
    if (offence !== undefined) return fail(offence);
    return ok(
      new TreatmentValues(record, {
        freshness: freshness.value,
        syncLevel: syncLevel.value,
        decision: decision.value,
        commercial: commercial.value,
      }),
    );
  }

  /** The defaults with what the merchant declared on top, value by value, judged as one. */
  static resolve(
    defaults: TreatmentValuesRecord,
    declared: DeclaredTreatmentValues,
  ): TreatmentResult<TreatmentValues> {
    return TreatmentValues.judge(TreatmentValues.merged(defaults, declared));
  }

  /** The merge itself, for whoever needs the record before judging it. */
  static merged(defaults: TreatmentValuesRecord, declared: DeclaredTreatmentValues): TreatmentValuesRecord {
    return {
      freshness: PolicyInput.merge(defaults.freshness, declared.freshness),
      syncLevel: PolicyInput.merge(defaults.syncLevel, declared.syncLevel),
      holdoutShare: declared.holdoutShare ?? defaults.holdoutShare,
      decisionPolicy: PolicyInput.merge(defaults.decisionPolicy, declared.decisionPolicy),
      commercialPolicy: PolicyInput.merge(defaults.commercialPolicy, declared.commercialPolicy),
      evidenceProfile: PolicyInput.merge(defaults.evidenceProfile, declared.evidenceProfile),
      surfaces: declared.surfaces ?? defaults.surfaces,
      barriers: declared.barriers ?? defaults.barriers,
      syncStrategy: PolicyInput.merge(defaults.syncStrategy, declared.syncStrategy),
      locales: declared.locales ?? defaults.locales,
    };
  }

  private static judgeStrategy(strategy: SyncStrategy): InvalidConfigurationValue | undefined {
    for (const flow of SYNC_FLOWS) {
      if (!(SYNC_MODES as readonly string[]).includes(strategy[flow])) {
        return new InvalidConfigurationValue(
          `syncStrategy.${flow}`,
          `must be one of ${SYNC_MODES.join(", ")}`,
        );
      }
    }
    return undefined;
  }

  /** The values as the configuration speaks them, for the contract and the stores. */
  record(): TreatmentValuesRecord {
    return TreatmentValues.merged(this.#record, {});
  }
}
