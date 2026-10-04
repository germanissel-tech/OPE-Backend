// Levels 1 and 2 of the configuration (constitution XI; ADR-031 as amended by feature 036): what the
// platform and the treatment defaults hold, published as numbered, immutable versions — the same thing a
// merchant configuration version already is, one level up.
//
// **What it does not do is judge the content.** A version of the platform level and one of the defaults
// level carry different vocabularies, and each is judged by the reader that knows it, the same way the
// declared values of a merchant are judged by the resolution and not by the entity. What lives here are the
// two rules that are the same for both levels: a corrective version carries its reason, and a content equal
// to the one in force is a repetition and not a new version.
import {
  ConfigurationReasonRequired,
  fail,
  ok,
  type ReleaseLevel,
  type Result,
} from "../shared-kernel/index.js";
import { ChangedLeaves } from "./changed-leaves.js";
import { MEASURING_PLATFORM_FIELDS } from "./platform-configuration.js";
import type { OperatorId } from "../operator/index.js";

/** What is published: everything but the number, which the store assigns. */
export interface LevelDraft {
  level: ReleaseLevel;
  /** The content as it was published. Judged by the reader of its level, not here. */
  content: Record<string, unknown>;
  corrective: boolean;
  reason?: string;
  publishedAt: Date;
  operatorId: OperatorId;
}

export interface LevelVersionRecord extends LevelDraft {
  version: number;
}

export class LevelVersion {
  readonly level: ReleaseLevel;
  readonly version: number;
  readonly content: Record<string, unknown>;
  readonly corrective: boolean;
  readonly reason: string | undefined;
  readonly publishedAt: Date;
  readonly operatorId: OperatorId;

  private constructor(record: LevelVersionRecord) {
    this.level = record.level;
    this.version = record.version;
    this.content = record.content;
    this.corrective = record.corrective;
    this.reason = record.reason;
    this.publishedAt = record.publishedAt;
    this.operatorId = record.operatorId;
  }

  /** A draft an operator may publish: a corrective version carries a reason that is not blank. */
  static draft(input: LevelDraft): Result<LevelDraft, ConfigurationReasonRequired> {
    if (input.corrective && (input.reason === undefined || input.reason.trim() === "")) {
      return fail(new ConfigurationReasonRequired());
    }
    return ok(input);
  }

  /** The draft with the number the store assigned. */
  static numbered(draft: LevelDraft, version: number): LevelVersion {
    return new LevelVersion({ ...draft, version });
  }

  static rehydrate(record: LevelVersionRecord): LevelVersion {
    return new LevelVersion(record);
  }

  /**
   * Publishing what the version in force already holds repeats it instead of creating another (FR-003).
   *
   * The reason and the corrective flag are part of the comparison: the same values published **with** a
   * reason is not a repetition but a corrective version, and a corrective version has consequences of its
   * own on the measurement windows.
   */
  sameContentAs(draft: LevelDraft): boolean {
    return (
      this.changedLeaves(draft).none() && this.corrective === draft.corrective && this.reason === draft.reason
    );
  }

  /** Which leaves a draft would change against this version, all of them: what `sameContentAs` compares. */
  changedLeaves(draft: LevelDraft): ChangedLeaves {
    return ChangedLeaves.between(this.content, draft.content);
  }

  /**
   * Which of those leaves can reach a measurement in course — what decides the experiments this change
   * freezes and the windows it restarts.
   *
   * **The whole of level 2 is treatment and level 1 is not**: five of its fields decide what is counted and
   * the other five are operational, so a publication that only moves a `Retry-After` reaches nobody. Asking
   * the version rather than the use case is what keeps that distinction with the level that owns it.
   */
  measuringLeaves(draft: LevelDraft): ChangedLeaves {
    const changed = this.changedLeaves(draft);
    return this.level === "platform" ? changed.under(MEASURING_PLATFORM_FIELDS) : changed;
  }

  /**
   * The name this version travels under wherever a level is quoted: in the triple every decision stamps and
   * in what the SDK receives (`platform-3`, `defaults-1`).
   *
   * **It is minted from the number and never declared**, which is the whole point of numbering these levels:
   * until this feature each release file carried a `version` of its own that nothing forced anyone to change
   * when the content did, so two different treatments could quote the same name. Now the name cannot lie —
   * it **is** the position in an immutable history.
   */
  versionName(): string {
    return `${this.level}-${this.version}`;
  }

  record(): LevelVersionRecord {
    return {
      level: this.level,
      version: this.version,
      content: this.content,
      corrective: this.corrective,
      ...(this.reason === undefined ? {} : { reason: this.reason }),
      publishedAt: this.publishedAt,
      operatorId: this.operatorId,
    };
  }
}
